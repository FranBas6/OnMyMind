-- Sesión 2.4 · Eventos (plan 02-fase-2, diseño 17, decisión de Fran del 2026-10-02).
--
-- Un evento pasa a «Fuera de la cabeza» al acabar su día, no a su hora: el dentista de las 10:00
-- sigue en Hoy, atenuado, hasta medianoche. `list_counters` lo contaba como hecho en cuanto pasaba
-- su hora (`due_at < now()`); ahora, cuando su día ya acabó (`due_at` antes del inicio de hoy).
-- «Hoy» es el de la zona horaria del perfil (`profiles.settings.timezone`, «Europe/Madrid» si no
-- hay o no es válida), igual que en el cliente (`isPastEvent`, features/items/events.ts), que usa
-- la del dispositivo. Referencia: docs/concept/03-modelo-de-datos.md §items.

-- El inicio de hoy para quien consulta.
create or replace function public.start_of_user_day()
returns timestamptz language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone zone.name) at time zone zone.name
  from (
    select coalesce(
      (select t.name from pg_catalog.pg_timezone_names t
       where t.name = (select p.settings ->> 'timezone' from public.profiles p
                       where p.id = (select auth.uid()))),
      'Europe/Madrid') as name
  ) zone
$$;

-- Igual que en `item_prices` (2.1), con el día en vez de la hora. El inicio de hoy se calcula una
-- sola vez por consulta (`cross join`), no por fila.
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as done_count,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.currency = 'EUR'), 0))::integer
    as pending_price_cents
from public.lists l
cross join (select public.start_of_user_day() as today) d
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;
