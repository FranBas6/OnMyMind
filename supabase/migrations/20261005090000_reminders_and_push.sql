-- Sesión 2.6 · Recordatorios y suscripción push (plan 02-fase-2, decisiones de Fran del
-- 2026-10-05). Referencia: docs/concept/03-modelo-de-datos.md §reminders y §push_subscriptions.
--
-- Un recordatorio por ítem (tareas y eventos). Uno relativo guarda su desfase (`offset_minutes`,
-- minutos antes del momento del ítem) y la base calcula `remind_at`: así es el mismo desde
-- cualquier dispositivo, se mueve solo cuando cambia la fecha del ítem y, si el ítem se repite,
-- salta a la vez siguiente. Uno personalizado («Personalizado…») guarda `remind_at` tal cual y
-- `offset_minutes` a null. El envío (la función `send-reminders`) es de la 2.7: busca
-- `remind_at <= now() and sent_at is null`, y para reprogramar uno que se repite le basta con
-- tocar la fila (`update … set remind_at = remind_at`), que lo recalcula.
--
-- La hora es la del reloj en la zona del perfil (`profiles.settings.timezone`, «Europe/Madrid» si
-- no hay o no es válida): «el día antes a las 9:00» son las 9:00 también el día del cambio de hora.
-- Lo de un día sin hora (una tarea con fecha, un evento de todo el día) se guarda a las 00:00 de
-- ese día (04 §Fechas), así que «ese día a las 9:00» es un desfase de -540 y «el día antes a las
-- 9:00», de 900.

-- La zona horaria de un usuario.
create or replace function public.user_timezone(p_user_id uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce(
    (select t.name from pg_catalog.pg_timezone_names t
     where t.name = (select p.settings ->> 'timezone' from public.profiles p
                     where p.id = p_user_id)),
    'Europe/Madrid')
$$;

-- Cuándo avisa un recordatorio relativo: `p_offset` minutos antes del momento del ítem, en la
-- hora del reloj de `p_tz`. Si se repite, la primera vez cuyo aviso no es anterior a `p_after`
-- (contando desde la primera, como `nextOccurrence` en features/items/events.ts: el 31 de cada mes
-- es el último de los meses cortos y vuelve a ser 31 cuando se puede).
create or replace function public.reminder_time(
  p_due_at timestamptz,
  p_recurrence text,
  p_offset integer,
  p_tz text,
  p_after timestamptz
)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  first_local timestamp := p_due_at at time zone p_tz;
  lead interval := make_interval(mins => p_offset);
  step interval;
  n integer;
  candidate timestamptz;
begin
  if p_due_at is null or p_offset is null then
    return null;
  end if;
  step := case p_recurrence
    when 'daily' then interval '1 day'
    when 'weekly' then interval '1 week'
    when 'monthly' then interval '1 month'
    when 'yearly' then interval '1 year'
  end;
  if step is null then
    return (first_local - lead) at time zone p_tz;
  end if;
  -- Una vuelta antes de la que toca más o menos, y de ahí hacia delante.
  n := greatest(0, (case p_recurrence
    when 'daily' then floor(extract(epoch from p_after - p_due_at) / 86400)
    when 'weekly' then floor(extract(epoch from p_after - p_due_at) / 604800)
    when 'monthly' then extract(year from age(p_after, p_due_at)) * 12
                        + extract(month from age(p_after, p_due_at))
    else extract(year from age(p_after, p_due_at))
  end)::integer - 1);
  for guard in 1..1000 loop
    candidate := (first_local + n * step - lead) at time zone p_tz;
    exit when candidate >= p_after;
    n := n + 1;
  end loop;
  return candidate;
end
$$;

create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items (id) on delete cascade,
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  remind_at       timestamptz not null,
  offset_minutes  integer,                  -- null = fecha absoluta elegida a mano
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint reminders_one_active_per_item unique (item_id)
);

create index reminders_due_idx on public.reminders (remind_at) where sent_at is null;
create index reminders_user_idx on public.reminders (user_id);

-- Antes de guardar: solo tareas y eventos; uno relativo necesita fecha y su `remind_at` lo pone la
-- base. Si cambia la hora del aviso, vuelve a estar pendiente de enviar.
create or replace function public.reminders_compute()
returns trigger language plpgsql set search_path = '' as $$
declare
  it record;
begin
  -- Con los permisos de quien guarda: un ítem que no puede ver no está.
  select i.kind, i.due_at, i.recurrence into it from public.items i where i.id = new.item_id;
  if not found then
    raise exception 'No existe el ítem.' using errcode = '23503';
  end if;
  if it.kind not in ('task', 'event') then
    raise exception 'Solo las tareas y los eventos llevan aviso.' using errcode = '23514';
  end if;
  if new.offset_minutes is not null then
    if it.due_at is null then
      raise exception 'Un aviso relativo necesita la fecha del ítem.' using errcode = '23514';
    end if;
    new.remind_at := public.reminder_time(
      it.due_at, it.recurrence, new.offset_minutes, public.user_timezone(new.user_id), now());
  end if;
  if tg_op = 'UPDATE' and new.remind_at is distinct from old.remind_at then
    new.sent_at := null;
  end if;
  return new;
end
$$;

create trigger reminders_compute
  before insert or update on public.reminders
  for each row execute function public.reminders_compute();

-- Al cambiar la fecha, la hora o la repetición del ítem, sus avisos relativos se recalculan; si se
-- queda sin fecha, se quitan (uno personalizado sigue). Si deja de ser tarea o evento, se quita.
create or replace function public.items_sync_reminders()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind not in ('task', 'event') then
    delete from public.reminders r where r.item_id = new.id;
  elsif new.due_at is null then
    delete from public.reminders r where r.item_id = new.id and r.offset_minutes is not null;
  else
    update public.reminders r set remind_at = r.remind_at
    where r.item_id = new.id and r.offset_minutes is not null;
  end if;
  return null;
end
$$;

create trigger items_sync_reminders
  after update of due_at, recurrence, kind on public.items
  for each row
  when (old.due_at is distinct from new.due_at
        or old.recurrence is distinct from new.recurrence
        or old.kind is distinct from new.kind)
  execute function public.items_sync_reminders();

alter table public.reminders enable row level security;

-- Cada uno, los suyos, y solo de ítems que puede ver.
create policy reminders_select on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy reminders_insert on public.reminders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.items i
                where i.id = item_id and public.is_list_member(i.list_id))
  );
create policy reminders_update on public.reminders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy reminders_delete on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()));

-- Una fila por navegador o dispositivo suscrito a Web Push.
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Se ven y se borran las propias. Se guardan con `save_push_subscription`: un mismo navegador
-- (el mismo `endpoint`) puede haber sido de otra cuenta, y entonces pasa a la de ahora.
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;
end
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
