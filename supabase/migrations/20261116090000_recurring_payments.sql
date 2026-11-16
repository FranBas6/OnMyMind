-- Sesión 6.3 · Pagos que se repiten: el modelo (plan 06-fase-6, idea 2; diseño 30).
--
-- Un pago es una compra con fecha («Fecha de pago»). Si además se repite, es un pago que se repite
-- (una suscripción, un recibo); si no, uno de una vez (la multa). No hay un tipo nuevo:
-- - pagar una que se repite (`bought`) hace lo que completar una tarea que se repite (3.6): apunta
--   la vez en `item_completions`, ahora con lo pagado, y salta al siguiente cobro, pendiente;
-- - `items.trial` («Es una prueba», diseño 30, P1): no cuenta en el total hasta su fecha, y pagarla
--   la deja en un pago más;
-- - los avisos valen también en las compras, y el aviso y el resumen de Hoy los cuentan;
-- - `list_counters` dice cuántos pagos hay y lo que suman al año los que se repiten (al mes, su
--   doceava parte, en la app).

-- ─── La prueba gratis ────────────────────────────────────────────────────────────────────────

alter table public.items add column trial boolean not null default false;

comment on column public.items.trial is
  'Es una prueba gratis (diseño 30, P1): solo en una compra con fecha que se repite. No cuenta en '
  'el total hasta su fecha; al pagarla deja de serlo.';

-- Solo en una compra con fecha que se repite: si deja de serlo (otro tipo, sin fecha o sin repetir),
-- deja de ser prueba. Va después de `items_repeat_task` (orden alfabético), que la apaga al pagar.
create function public.items_trial_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.trial and (new.kind <> 'shopping' or new.recurrence is null or new.due_at is null) then
    new.trial := false;
  end if;
  return new;
end $$;

create trigger items_trial_check before insert or update on public.items
  for each row execute function public.items_trial_check();

-- ─── Lo pagado cada vez ──────────────────────────────────────────────────────────────────────

-- El importe de esa vez (el precio que tenía al pagarla) y si era la prueba, para deshacer.
alter table public.item_completions
  add column price_cents integer check (price_cents is null or price_cents >= 0),
  add column currency text,
  add column trial boolean not null default false;

-- Como en la 3.6, también al pagar una compra que se repite: apunta la vez, con lo pagado, y pasa
-- al siguiente cobro, pendiente. La siguiente es la primera después de la fecha que tenía y no
-- antes de mañana: pagar Netflix el 15 de noviembre con fecha del 3 de diciembre la deja el 3 de
-- enero (F4). Si era la prueba, deja de serlo.
create or replace function public.items_repeat_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tz text;
  due_local timestamp;
  next_local timestamp;
  paid boolean := new.kind = 'shopping';
begin
  if new.recurrence is null or new.due_at is null or old.status = new.status
     or not ((new.kind = 'task' and new.status = 'done')
             or (new.kind = 'shopping' and new.status = 'bought')) then
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
  insert into public.item_completions (item_id, done_by, occurrence, price_cents, currency, trial)
  values (new.id, (select auth.uid()), new.due_at,
          case when paid then new.price_cents end, case when paid then new.currency end,
          old.trial);
  new.due_at := next_local at time zone tz;
  new.status := 'pending';
  new.completed_at := null;
  new.trial := false;
  return new;
end $$;

-- «Deshacer»: también vuelve a ser prueba si lo era.
create or replace function public.undo_repeat(p_item_id uuid)
returns void language sql security invoker set search_path = '' as $$
  with last as (
    delete from public.item_completions c
    where c.id = (select c2.id from public.item_completions c2
                  where c2.item_id = p_item_id
                  order by c2.done_at desc, c2.occurrence desc limit 1)
    returning c.occurrence, c.trial
  )
  update public.items i set due_at = last.occurrence, trial = last.trial
  from last
  where i.id = p_item_id
$$;

-- ─── Lo que suma al año ──────────────────────────────────────────────────────────────────────

-- Cuántas veces al año pasa una regla (`recurrence_rule`): al día, 365; a la semana, 52 por cada
-- día que toca; al mes, 12; al año, 1; entre su intervalo. El total al mes es esto entre 12: un
-- pago anual cuenta su doceava parte (diseño 30, L1). `null` si no se entiende.
create function public.recurrence_per_year(p_rule text)
returns numeric language sql immutable set search_path = '' as $$
  select case substring(r.rule from 'FREQ=([A-Z]+)')
      when 'DAILY' then 365
      when 'WEEKLY' then 52 * coalesce(cardinality(string_to_array(
        substring(r.rule from 'BYDAY=([A-Z,]+)$'), ',')), 1)
      when 'MONTHLY' then 12
      when 'YEARLY' then 1
    end::numeric / coalesce(substring(r.rule from 'INTERVAL=([0-9]+)')::integer, 1)
  from (select public.recurrence_rule(p_rule) as rule) r
  where public.recurrence_is_valid(public.recurrence_rule(p_rule))
$$;

-- Como en la 5.3, con cuatro columnas más al final:
-- - `payment_count`: los pagos pendientes, compras con fecha, se repitan o no (también los que
--   están en prueba): «4 pagos»;
-- - `trial_count`: los que aún están en prueba (su fecha es mañana o después): «1 en prueba»;
-- - `yearly_cents`: lo que suman al año los pagos que se repiten, en euros, sin los que están en
--   prueba; `null` si no hay ninguno que se repita, y entonces la cabecera dice «Total»;
-- - `once_cents`: lo pendiente que no se repite, lo de `pending_price_cents` sin los pagos que se
--   repiten: «60 € de una vez».
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null and i.kind <> 'note'
    and not coalesce(p.choose_one, false)
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < d.today))
   + count(distinct i.parent_id) filter (where i.completed_at is null and p.choose_one
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as done_count,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.currency = 'EUR' and not coalesce(p.choose_one, false)), 0)
   + max(o.cents))::integer
    as pending_price_cents,
  (count(i.id) filter (where i.kind = 'note' and not coalesce(p.choose_one, false)))::integer
    as notes_count,
  max(k.notes)::integer as note_total,
  max(k.tasks)::integer as task_total,
  max(k.shopping)::integer as shopping_total,
  max(k.events)::integer as event_total,
  (count(i.id) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.due_at is not null))::integer
    as payment_count,
  (count(i.id) filter (where i.kind = 'shopping' and i.completed_at is null and i.trial
    and i.due_at >= d.today + interval '1 day'))::integer
    as trial_count,
  case when bool_or(i.kind = 'shopping' and i.completed_at is null and i.due_at is not null
                    and i.recurrence is not null) then
    round(coalesce(sum(i.price_cents * public.recurrence_per_year(i.recurrence))
      filter (where i.kind = 'shopping' and i.completed_at is null and i.due_at is not null
        and i.recurrence is not null and i.currency = 'EUR'
        and not (i.trial and i.due_at >= d.today + interval '1 day')), 0))::integer
  end
    as yearly_cents,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.currency = 'EUR' and not coalesce(p.choose_one, false)
    and (i.recurrence is null or i.due_at is null)), 0)
   + max(o.cents))::integer
    as once_cents
from public.lists l
cross join (select public.start_of_user_day() as today) d
cross join lateral (
  select coalesce(sum(
    case
      when e.id is not null then
        case when e.kind = 'shopping' and e.currency = 'EUR' then e.price_cents end
      else (
        select min(c.price_cents) from public.items c
        where c.parent_id = s.id and c.kind = 'shopping' and c.completed_at is null
          and c.currency = 'EUR' and c.price_cents is not null
      )
    end), 0) as cents
  from public.items s
  left join public.items e
    on e.id = s.chosen_id and e.parent_id = s.id and e.completed_at is null
  where s.list_id = l.id and s.kind = 'sublist' and s.choose_one
    and public.is_active_sublist_status(s.status)
) o
cross join lateral (
  select
    count(*) filter (where x.kind = 'note') as notes,
    count(*) filter (where x.kind = 'task') as tasks,
    count(*) filter (where x.kind = 'shopping') as shopping,
    count(*) filter (where x.kind = 'event') as events
  from public.items x
  where x.list_id = l.id
) k
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;

-- ─── Los avisos, también en las compras ──────────────────────────────────────────────────────

-- Como en la 2.6, con las compras: el aviso de un pago (diseño 30, F1 y P1).
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
  if it.kind not in ('task', 'event', 'shopping') then
    raise exception 'Solo las tareas, los eventos y las compras llevan aviso.' using errcode = '23514';
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

-- Con los permisos del dueño, como desde la 3.1: si el otro cambia la fecha, tu aviso se mueve.
create or replace function public.items_sync_reminders()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind not in ('task', 'event', 'shopping') then
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

-- Como en la 5.8, con el precio y si es prueba al final, para el texto de un pago: «Mañana se
-- cobra · 12,99 €» o «Pasado mañana empieza a cobrar Disney+ · 8,99 €…» (diseño 30, P2).
drop function public.claim_due_reminders(integer);

create function public.claim_due_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid, user_id uuid, item_id uuid, list_id uuid, title text, kind text,
  all_day boolean, list_name text, remind_at timestamptz, occurs_at timestamptz,
  occurs_local text, now_local text, done boolean, hidden boolean, concealed boolean,
  price_cents integer, currency text, recurring boolean, trial boolean)
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
    i.price_cents, i.currency, i.recurrence is not null, i.trial
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

-- Como en la 5.8, con los pagos de hoy y los atrasados, que van con las tareas (diseño 30, H1).
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
    and ((i.kind in ('task', 'shopping') and i.completed_at is null and i.due_at < b.day_end)
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

-- ─── Permisos ────────────────────────────────────────────────────────────────────────────────

revoke execute on function public.items_trial_check() from public, anon, authenticated;
