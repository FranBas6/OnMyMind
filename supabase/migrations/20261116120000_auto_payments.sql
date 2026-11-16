-- Sesión 6.5 · Se cobra solo (plan 06-fase-6; Fran, 2026-11-16, al probar la 6.4).
--
-- Un pago que se repite puede estar domiciliado (Youtube) o pagarse a mano (Spotify, el coche):
-- - `items.auto_pay` («Se cobra solo»), encendido por defecto: solo cuenta en una compra con fecha
--   que se repite. El día del cobro, `charge_auto_payments` (cada 5 minutos) apunta la vez, con su
--   fecha, y la pasa al siguiente cobro, sin abrir la app;
-- - `item_completions.auto`: la vez la apuntó la base, no alguien («Se cobró solo»);
-- - el aviso sabe si se cobra solo («Se cobra mañana») y el resumen de Hoy no los cuenta: no son
--   algo que hacer.

alter table public.items add column auto_pay boolean not null default true;

comment on column public.items.auto_pay is
  'Se cobra solo (6.5): en una compra con fecha que se repite, el día del cobro se apunta sola como '
  'pagada y salta al siguiente (charge_auto_payments). Apagado, se paga a mano.';

alter table public.item_completions add column auto boolean not null default false;

-- Apunta los cobros vencidos de lo que se cobra solo: una vez por cada cobro que haya pasado (con
-- su fecha como `done_at`, así sale en «Hecho hoy» el día que toca y el historial dice cuándo), y
-- deja el pago en el siguiente. La siguiente es la primera después de la que tenía, en la zona de
-- quien creó la lista. Si era la prueba, el primer cobro lo recuerda y deja de serlo. Devuelve
-- cuántos cobros apuntó.
create function public.charge_auto_payments()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  it record;
  tz text;
  due_local timestamp;
  next_local timestamp;
  first boolean;
  charged integer := 0;
begin
  for it in
    select i.id, i.due_at, i.recurrence, i.price_cents, i.currency, i.trial, l.owner_id
    from public.items i
    join public.lists l on l.id = i.list_id
    where i.kind = 'shopping' and i.auto_pay and i.recurrence is not null
      and i.due_at is not null and i.completed_at is null and i.due_at <= now()
    for update of i skip locked
  loop
    tz := public.user_timezone(it.owner_id);
    due_local := it.due_at at time zone tz;
    first := true;
    -- Como mucho cinco años de cobros atrasados de una vez.
    for guard in 1..260 loop
      exit when (due_local at time zone tz) > now();
      next_local := public.recurrence_occurrence(due_local, it.recurrence,
                                                 due_local + interval '1 second');
      exit when next_local is null;
      insert into public.item_completions
        (item_id, done_at, done_by, occurrence, price_cents, currency, trial, auto)
      values (it.id, due_local at time zone tz, null, due_local at time zone tz, it.price_cents,
              it.currency, it.trial and first, true);
      charged := charged + 1;
      first := false;
      due_local := next_local;
    end loop;
    if not first then
      update public.items set due_at = due_local at time zone tz, trial = false where id = it.id;
    end if;
  end loop;
  return charged;
end $$;

revoke execute on function public.charge_auto_payments() from public, anon, authenticated;

-- Cada 5 minutos. Con el mismo nombre, `cron.schedule` reemplaza el trabajo en vez de duplicarlo.
select cron.schedule('charge-auto-payments', '*/5 * * * *', 'select public.charge_auto_payments()');

-- ─── Los avisos ──────────────────────────────────────────────────────────────────────────────

-- Como en la 6.3, con `auto_pay` al final: «Se cobra mañana» o «Vence mañana».
drop function public.claim_due_reminders(integer);

create function public.claim_due_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid, user_id uuid, item_id uuid, list_id uuid, title text, kind text,
  all_day boolean, list_name text, remind_at timestamptz, occurs_at timestamptz,
  occurs_local text, now_local text, done boolean, hidden boolean, concealed boolean,
  price_cents integer, currency text, recurring boolean, trial boolean, auto_pay boolean)
language sql set search_path = '' as $$
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
      or (i.parent_id is not null and not public.is_active_sublist_status(p.status)),
    exists (select 1 from public.hidden_lists h
            where h.user_id = r.user_id and h.list_id = i.list_id),
    i.price_cents, i.currency, i.recurrence is not null, i.trial, i.auto_pay
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

revoke execute on function public.claim_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- Como en la 6.3, sin lo que se cobra solo.
create or replace function public.claim_daily_summaries()
returns table (user_id uuid, kind text, title text, all_day boolean, occurs_local text,
               overdue boolean)
language sql set search_path = '' as $$
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
         i.kind in ('task', 'shopping') and i.due_at < b.day_start
  from bounds b
  join public.lists l
    on l.archived_at is null
   and (l.owner_id = b.id
        or exists (select 1 from public.list_members m
                   where m.list_id = l.id and m.user_id = b.id and m.accepted_at is not null))
   and not exists (select 1 from public.hidden_lists h where h.list_id = l.id and h.user_id = b.id)
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
    and ((i.kind in ('task', 'shopping') and i.completed_at is null and i.due_at < b.day_end
          -- Lo que se cobra solo no es algo que hacer (6.5).
          and not (i.kind = 'shopping' and i.auto_pay and i.recurrence is not null))
      or (i.kind = 'event' and i.status = 'upcoming'
          and o.occurs_at >= b.day_start and o.occurs_at < b.day_end))
  order by b.id,
           i.kind = 'event' desc,
           case when i.kind = 'event' then not i.all_day end,
           case when i.kind = 'event' then o.occurs_at end,
           l.position,
           case when i.kind in ('task', 'shopping') then i.due_at end,
           case i.fields ->> 'priority' when 'high' then 0 when 'medium' then 1 when 'low' then 2
             else 3 end,
           i.position
$$;

