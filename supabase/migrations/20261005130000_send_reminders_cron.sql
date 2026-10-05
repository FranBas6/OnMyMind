-- Sesión 2.7 · Envío de avisos (plan 02-fase-2; 04 §send-reminders). Cada minuto, `pg_cron` llama
-- con `pg_net` a la edge function `send-reminders`, que envía los avisos vencidos y el resumen de
-- Hoy. Lo que toca enviar lo reclama la función con `claim_due_reminders` y
-- `claim_daily_summaries`, que lo marcan en la misma sentencia: si dos llamadas se pisan, cada
-- aviso sale una vez (antes perder uno que repetirlo).
--
-- La llamada lleva una cabecera secreta (`x-cron-secret`). El secreto lo genera esta migración en
-- Vault y nunca sale de la base: la función lo comprueba con `verify_cron_secret`. La dirección de
-- la función también va en Vault (`send_reminders_url`), pero no la pone la migración, porque es
-- distinta en local y en la nube: hasta que exista, el cron no llama a nada.
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-reminders',
--                              'send_reminders_url');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- El día (en su zona) en que ya salió el resumen de Hoy de cada uno: uno al día como mucho.
alter table public.profiles add column summary_sent_on date;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'send_reminders_secret',
  'Cabecera x-cron-secret con la que pg_cron llama a send-reminders (2.7)')
where not exists (select 1 from vault.secrets where name = 'send_reminders_secret');

-- Si la cabecera de una llamada es el secreto. Compara los resúmenes, no el texto, para que el
-- tiempo de la comparación no diga cuánto se acertó.
create or replace function public.verify_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(p_secret, 'sha256')
     from vault.decrypted_secrets s where s.name = 'send_reminders_secret'),
    false)
$$;

-- Los avisos vencidos, ya reclamados: `sent_at` queda puesto y, de paso, se toca `remind_at`. Así
-- `reminders_compute` (2.6) recalcula los relativos: uno que se repite pasa a la vez siguiente y
-- vuelve a estar pendiente; uno que no, se queda igual y enviado. El `select` de fuera ve las
-- filas de antes del cambio (la misma foto que la sentencia), que es la vez que toca avisar.
--
-- De cada uno, lo que hace falta para su texto (`messages.ts` de la función): el momento del ítem
-- que avisa (`occurs_at`) y, en la zona del usuario, ese momento y ahora como «2026-10-08T10:00».
-- `done` (está terminado) y `hidden` (lista archivada o sublista pausada o hecha) no se envían.
create or replace function public.claim_due_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid,
  user_id uuid,
  item_id uuid,
  list_id uuid,
  title text,
  kind text,
  all_day boolean,
  list_name text,
  remind_at timestamptz,
  occurs_at timestamptz,
  occurs_local text,
  now_local text,
  done boolean,
  hidden boolean
)
language sql volatile set search_path = '' as $$
  with due as (
    select r.id
    from public.reminders r
    where r.sent_at is null and r.remind_at <= now()
    order by r.remind_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.reminders r
    set sent_at = now(), remind_at = r.remind_at
    from due
    where r.id = due.id
    returning r.id
  )
  select
    r.id, r.user_id, i.id, i.list_id, i.title, i.kind::text, i.all_day, l.name, r.remind_at,
    o.occurs_at,
    to_char(o.occurs_at at time zone z.tz, 'YYYY-MM-DD"T"HH24:MI'),
    to_char(now() at time zone z.tz, 'YYYY-MM-DD"T"HH24:MI'),
    i.completed_at is not null,
    l.archived_at is not null
      or (i.parent_id is not null and not public.is_active_sublist_status(p.status))
  from claimed c
  join public.reminders r on r.id = c.id
  join public.items i on i.id = r.item_id
  join public.lists l on l.id = i.list_id
  left join public.items p on p.id = i.parent_id
  cross join lateral (select public.user_timezone(r.user_id) as tz) z
  cross join lateral (
    select case
      -- Uno relativo: el momento del ítem es el aviso más su desfase, en la hora del reloj.
      when r.offset_minutes is not null then
        ((r.remind_at at time zone z.tz) + make_interval(mins => r.offset_minutes)) at time zone z.tz
      when i.due_at is null then null
      when i.recurrence is null then i.due_at
      -- Uno personalizado en algo que se repite: la vez de ese día o la siguiente.
      else public.reminder_time(i.due_at, i.recurrence, 0, z.tz,
                                date_trunc('day', r.remind_at at time zone z.tz) at time zone z.tz)
    end as occurs_at
  ) o
  order by r.remind_at
$$;

-- Quién recibe ahora el resumen de Hoy, ya reclamado (`summary_sent_on` = hoy), y qué tiene para
-- hoy: lo mismo que la pantalla Hoy (`fetchToday` y `groupToday`), en su orden. Primero la Agenda
-- (los de todo el día y luego por hora), después las tareas que vencen hoy o antes, por listas.
-- Le toca a quien tiene `daily_summary_time` entre esa hora y 15 minutos después, en su zona, y
-- algún dispositivo suscrito. Quien no tiene nada para hoy queda reclamado y no recibe nada
-- («Si no hay nada, no llega», diseño 18).
create or replace function public.claim_daily_summaries()
returns table (
  user_id uuid,
  kind text,
  title text,
  all_day boolean,
  occurs_local text,
  overdue boolean
)
language sql volatile set search_path = '' as $$
  with due as (
    select p.id, z.tz, now() at time zone z.tz as local_now
    from public.profiles p
    cross join lateral (select public.user_timezone(p.id) as tz) z
    where p.settings ->> 'daily_summary_time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (now() at time zone z.tz)::time - (p.settings ->> 'daily_summary_time')::time
          between interval '0' and interval '15 minutes'
      and (p.summary_sent_on is null or p.summary_sent_on < (now() at time zone z.tz)::date)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    for update of p skip locked
  ),
  claimed as (
    update public.profiles p
    set summary_sent_on = due.local_now::date
    from due
    where p.id = due.id
    returning p.id
  ),
  bounds as (
    select d.id, d.tz,
           date_trunc('day', d.local_now) at time zone d.tz as day_start,
           (date_trunc('day', d.local_now) + interval '1 day') at time zone d.tz as day_end
    from due d
    join claimed c on c.id = d.id
  )
  select b.id, i.kind::text, i.title, i.all_day,
         to_char(o.occurs_at at time zone b.tz, 'YYYY-MM-DD"T"HH24:MI'),
         i.kind = 'task' and i.due_at < b.day_start
  from bounds b
  join public.lists l
    on l.archived_at is null
   and (l.owner_id = b.id
        or exists (select 1 from public.list_members m
                   where m.list_id = l.id and m.user_id = b.id and m.accepted_at is not null))
  join public.items i on i.list_id = l.id
  left join public.items p on p.id = i.parent_id
  cross join lateral (
    select case
      when i.kind = 'event' and i.recurrence is not null then
        public.reminder_time(i.due_at, i.recurrence, 0, b.tz, b.day_start)
      else i.due_at
    end as occurs_at
  ) o
  where i.due_at is not null
    and (i.parent_id is null or public.is_active_sublist_status(p.status))
    and ((i.kind = 'task' and i.completed_at is null and i.due_at < b.day_end)
      or (i.kind = 'event' and i.status = 'upcoming'
          and o.occurs_at >= b.day_start and o.occurs_at < b.day_end))
  order by b.id,
           i.kind = 'event' desc,
           case when i.kind = 'event' then not i.all_day end,
           case when i.kind = 'event' then o.occurs_at end,
           l.position,
           case when i.kind = 'task' then i.due_at end,
           case i.fields ->> 'priority' when 'high' then 0 when 'medium' then 1 when 'low' then 2
             else 3 end,
           i.position
$$;

-- Solo la función, con `service_role`; nadie desde la app.
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
revoke execute on function public.claim_due_reminders(integer) from public, anon, authenticated;
revoke execute on function public.claim_daily_summaries() from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;
grant execute on function public.claim_due_reminders(integer) to service_role;
grant execute on function public.claim_daily_summaries() to service_role;

-- Lo que hace el cron: una petición a la función con la cabecera secreta. `pg_net` la manda en
-- segundo plano (devuelve el id de la petición y la respuesta llega a `net._http_response`), así que
-- el cron no espera a que se envíen los avisos. Sin la dirección en Vault, no hace nada.
create or replace function public.invoke_send_reminders()
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  target text;
  secret text;
begin
  select s.decrypted_secret into target
  from vault.decrypted_secrets s where s.name = 'send_reminders_url';
  select s.decrypted_secret into secret
  from vault.decrypted_secrets s where s.name = 'send_reminders_secret';
  if target is null or secret is null then
    return null;
  end if;
  return net.http_post(
    url := target,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    timeout_milliseconds := 30000
  );
end
$$;

revoke execute on function public.invoke_send_reminders() from public, anon, authenticated;

-- Cada minuto. Con el mismo nombre, `cron.schedule` reemplaza el trabajo en vez de duplicarlo.
select cron.schedule('send-reminders', '* * * * *', 'select public.invoke_send_reminders()');

-- El historial del cron crece una fila por minuto: se queda con la última semana.
select cron.schedule(
  'purge-cron-history',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
