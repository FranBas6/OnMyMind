-- Sesión 3.6 · Repetición personalizada, también en tareas (plan 03-fase-3; diseño 21, parte B).
--
-- - `items.recurrence` pasa a ser un subconjunto de RRULE (RFC 5545), el que entiende el Calendario
--   del iPhone (3.7): FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY (los días de la semana;
--   en MONTHLY, uno con ordinal: 1MO, -1FR) y BYMONTHDAY. `daily`… pasan a `FREQ=DAILY`…
-- - La siguiente vez se calcula como en features/items/recurrence.ts, con los mismos casos de
--   prueba (supabase/tests/recurrence_cases.test.sql, generado de recurrence.cases.ts):
--   `recurrence_occurrence` en hora de reloj y `next_occurrence` con zona. `reminder_time` (avisos,
--   envío y resumen de Hoy) la usa, así que todo lo que ya leía la repetición entiende las nuevas.
-- - Una tarea que se repite, al completarla, pasa sola a su siguiente fecha y sigue pendiente; la
--   vez hecha queda en `item_completions` («Hecho hoy», «Hecho ese día»). Deshacer la devuelve.
--
-- Reglas de la casa (las mismas en TypeScript): la semana empieza el lunes; un día que el mes no
-- tiene es el último del mes; el 29 de febrero, el 28 los años que no es bisiesto; las horas son de
-- reloj, también con el cambio de hora.

-- ─── La regla ────────────────────────────────────────────────────────────────────────────────

-- Lo de antes de la 3.6 se lee como su regla.
create or replace function public.recurrence_rule(p_text text)
returns text language sql immutable set search_path = '' as $$
  select case p_text
    when 'daily' then 'FREQ=DAILY'
    when 'weekly' then 'FREQ=WEEKLY'
    when 'monthly' then 'FREQ=MONTHLY'
    when 'yearly' then 'FREQ=YEARLY'
    else p_text
  end
$$;

-- Si una regla es del subconjunto, escrita como la escribe la app (`formatRule`): FREQ primero,
-- INTERVAL si no es 1, los días de lunes a domingo sin repetir, y BYDAY con ordinal o BYMONTHDAY
-- solo en MONTHLY (no los dos).
create or replace function public.recurrence_is_valid(p_rule text)
returns boolean language sql immutable set search_path = '' as $$
  with weekly as (select substring(p_rule from ';BYDAY=([A-Z,]+)$') as days)
  select p_rule ~ '^FREQ=(DAILY|YEARLY)(;INTERVAL=([2-9]|[1-9][0-9]{1,2}))?$'
      or p_rule ~ ('^FREQ=MONTHLY(;INTERVAL=([2-9]|[1-9][0-9]{1,2}))?'
                   || '(;BYDAY=(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)|;BYMONTHDAY=([1-9]|[12][0-9]|3[01]))?$')
      or (p_rule ~ '^FREQ=WEEKLY(;INTERVAL=([2-9]|[1-9][0-9]{1,2}))?(;BYDAY=[A-Z,]+)?$'
          -- Los días, rehechos en orden y sin repetir, tienen que dar lo mismo que lo escrito.
          and (select w.days is null or w.days = (
                 select coalesce(string_agg(d, ',' order by o), '')
                 from unnest(array['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
                   with ordinality as t(d, o)
                 where d = any (string_to_array(w.days, ',')))
               from weekly w))
$$;

alter table public.items drop constraint items_recurrence_check;
update public.items set recurrence = public.recurrence_rule(recurrence) where recurrence is not null;
alter table public.items add constraint items_recurrence_check
  check (recurrence is null or public.recurrence_is_valid(recurrence));

-- ─── La siguiente vez ────────────────────────────────────────────────────────────────────────

-- Ese día del mes con la hora de `p_time` (el último del mes si no lo tiene).
create or replace function public.recurrence_on_day(p_month date, p_day integer, p_time timestamp)
returns timestamp language sql immutable set search_path = '' as $$
  select (p_month + (least(p_day, extract(day from (p_month + interval '1 month - 1 day'))::integer)
          - 1))::timestamp + (p_time - date_trunc('day', p_time))
$$;

-- La primera vez de la serie desde `p_from` (incluido), nunca antes de `p_first`, en hora de reloj.
-- Va por vueltas (días, semanas, meses o años contados desde `p_first`), como `occurrencesFrom` en
-- recurrence.ts. `null` si la regla no se entiende.
create or replace function public.recurrence_occurrence(
  p_first timestamp,
  p_rule text,
  p_from timestamp
)
returns timestamp language plpgsql immutable set search_path = '' as $$
declare
  rule text := public.recurrence_rule(p_rule);
  freq text := substring(rule from 'FREQ=([A-Z]+)');
  step integer := coalesce(substring(rule from 'INTERVAL=([0-9]+)')::integer, 1);
  byday text := substring(rule from 'BYDAY=([-0-9A-Z,]+)');
  monthday integer := substring(rule from 'BYMONTHDAY=([0-9]+)')::integer;
  start timestamp := greatest(p_first, p_from);
  time_of_day interval := p_first - date_trunc('day', p_first);
  days text[] := array['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  k integer;
  base date;
  candidate timestamp;
  best timestamp;
  ordinal integer;
  target integer;
  first_dow integer;
  last_day date;
begin
  if rule is null or not public.recurrence_is_valid(rule) then
    return null;
  end if;
  -- Una vuelta antes de la que toca, más o menos, y de ahí hacia delante.
  k := greatest(0, (case freq
    when 'DAILY' then (start::date - p_first::date)
    when 'WEEKLY' then ((date_trunc('week', start)::date - date_trunc('week', p_first)::date) / 7)
    when 'MONTHLY' then ((extract(year from start) - extract(year from p_first)) * 12
                         + extract(month from start) - extract(month from p_first))::integer
    else (extract(year from start) - extract(year from p_first))::integer
  end) / step - 1);

  for guard in 1..5000 loop
    best := null;
    if freq = 'DAILY' then
      best := p_first + make_interval(days => k * step);
    elsif freq = 'WEEKLY' then
      base := date_trunc('week', p_first)::date + k * step * 7;
      for i in 1..7 loop
        if (byday is null and extract(isodow from p_first) = i)
           or (byday is not null and days[i] = any (string_to_array(byday, ','))) then
          candidate := (base + (i - 1))::timestamp + time_of_day;
          if candidate >= start then
            best := candidate;
            exit;
          end if;
        end if;
      end loop;
    elsif freq = 'MONTHLY' then
      base := (date_trunc('month', p_first) + make_interval(months => k * step))::date;
      if byday is not null then
        ordinal := substring(byday from '^(-?[0-9])')::integer;
        target := array_position(days, substring(byday from '([A-Z]{2})$'));
        if ordinal > 0 then
          first_dow := extract(isodow from base)::integer;
          candidate := (base + ((target - first_dow + 7) % 7) + (ordinal - 1) * 7)::timestamp
                       + time_of_day;
        else
          last_day := (base + interval '1 month - 1 day')::date;
          candidate := (last_day - ((extract(isodow from last_day)::integer - target + 7) % 7))
                       ::timestamp + time_of_day;
        end if;
      else
        candidate := public.recurrence_on_day(base, coalesce(monthday,
                       extract(day from p_first)::integer), p_first);
      end if;
      best := candidate;
    else
      -- `+ interval 'n years'` deja el 29 de febrero en el 28 los años que no es bisiesto.
      best := p_first + make_interval(years => k * step);
    end if;
    if best is not null and best >= start then
      return best;
    end if;
    k := k + 1;
  end loop;
  return null;
end
$$;

-- La de antes (2.6), con la regla nueva: cuándo avisa un recordatorio relativo, `p_offset` minutos
-- antes del momento del ítem, en la hora del reloj de `p_tz`. Si se repite, la primera vez cuyo
-- aviso no es anterior a `p_after`.
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
  occurrence timestamp;
  candidate timestamptz;
begin
  if p_due_at is null or p_offset is null then
    return null;
  end if;
  if p_recurrence is null then
    return (first_local - lead) at time zone p_tz;
  end if;
  -- Un día de margen por el cambio de hora; de ahí, la primera cuyo aviso no ha pasado.
  occurrence := public.recurrence_occurrence(
    first_local, p_recurrence, (p_after at time zone p_tz) + lead - interval '1 day');
  for guard in 1..1000 loop
    exit when occurrence is null;
    candidate := (occurrence - lead) at time zone p_tz;
    exit when candidate >= p_after;
    occurrence := public.recurrence_occurrence(
      first_local, p_recurrence, occurrence + interval '1 second');
  end loop;
  return candidate;
end
$$;

-- La primera vez de un ítem que se repite desde `p_after` (incluido), en la zona `p_tz`. Es la que
-- prueban los casos compartidos con TypeScript.
create or replace function public.next_occurrence(
  p_first timestamptz,
  p_rule text,
  p_tz text,
  p_after timestamptz
)
returns timestamptz language sql stable set search_path = '' as $$
  select public.reminder_time(p_first, p_rule, 0, p_tz, p_after)
$$;

-- ─── Tareas que se repiten ───────────────────────────────────────────────────────────────────

-- Cada vez que se completó una tarea que se repite: «Hecho hoy» y «Hecho ese día» (diseño 21, B12
-- y B13). `occurrence` es la fecha que tenía, para deshacer.
create table public.item_completions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  done_at     timestamptz not null default now(),
  done_by     uuid references public.profiles (id) on delete set null,
  occurrence  timestamptz not null
);

create index item_completions_item_idx on public.item_completions (item_id, done_at desc);
create index item_completions_done_idx on public.item_completions (done_at);

alter table public.item_completions enable row level security;

-- Las ve y las borra (deshacer) quien ve el ítem; las escribe el trigger.
create policy item_completions_select on public.item_completions for select to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_id and public.is_list_member(i.list_id)));
create policy item_completions_delete on public.item_completions for delete to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_id and public.is_list_member(i.list_id)));

-- Al completar una tarea que se repite, no baja a «Fuera de la cabeza»: apunta la vez hecha y pasa
-- a la siguiente fecha, pendiente (B9, B10). La siguiente es la primera después de la fecha que
-- tenía y no antes de mañana (`nextAfterDone`). Va antes de `items_validate`, que al verla
-- pendiente le quita `completed_at`. Sin siguiente (una regla rota), se completa como cualquiera.
create or replace function public.items_repeat_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tz text;
  due_local timestamp;
  next_local timestamp;
begin
  if new.kind <> 'task' or new.recurrence is null or new.due_at is null
     or new.status <> 'done' or old.status = 'done' then
    return new;
  end if;
  tz := public.user_timezone(coalesce((select auth.uid()),
          (select l.owner_id from public.lists l where l.id = new.list_id)));
  due_local := new.due_at at time zone tz;
  next_local := public.recurrence_occurrence(due_local, new.recurrence, greatest(
    due_local + interval '1 second',
    date_trunc('day', now() at time zone tz) + interval '1 day'));
  if next_local is null then
    return new;
  end if;
  insert into public.item_completions (item_id, done_by, occurrence)
  values (new.id, (select auth.uid()), new.due_at);
  new.due_at := next_local at time zone tz;
  new.status := 'pending';
  new.completed_at := null;
  return new;
end $$;

create trigger items_repeat_task before update of status on public.items
  for each row execute function public.items_repeat_task();

-- «Deshacer» (B10): la última vez hecha se borra y la tarea vuelve a la fecha que tenía. Con los
-- permisos de quien lo pide: solo si ve la tarea.
create or replace function public.undo_repeat(p_item_id uuid)
returns void language sql security invoker set search_path = '' as $$
  with last as (
    delete from public.item_completions c
    where c.id = (select c2.id from public.item_completions c2
                  where c2.item_id = p_item_id
                  order by c2.done_at desc, c2.occurrence desc limit 1)
    returning c.occurrence
  )
  update public.items i set due_at = last.occurrence
  from last
  where i.id = p_item_id
$$;

-- El aviso se mueve con la fecha también cuando la cambia un trigger (al completar, arriba): el de
-- la 2.6 era `after update of due_at…`, y eso solo mira las columnas que nombra el `update`.
drop trigger items_sync_reminders on public.items;
create trigger items_sync_reminders
  after update on public.items
  for each row
  when (old.due_at is distinct from new.due_at
        or old.recurrence is distinct from new.recurrence
        or old.kind is distinct from new.kind)
  execute function public.items_sync_reminders();

-- ─── Permisos ────────────────────────────────────────────────────────────────────────────────

revoke execute on function public.items_repeat_task() from public, anon, authenticated;
revoke execute on function public.undo_repeat(uuid) from public, anon;
grant execute on function public.undo_repeat(uuid) to authenticated;
