-- Sesión 2a.1 · El tipo pasa a ser de cada ítem (ADR-009, opción A).
--
-- Hasta ahora el tipo era de la lista (`lists.kind`) y todo lo decidía ella: qué estados valen, qué
-- cuenta como pasado, qué sale en Hoy. Desde aquí cada ítem guarda el suyo (`items.kind`) y
-- `lists.kind` pasa a significar «tipo por defecto»: el tipo con el que nacen los ítems nuevos.
-- Referencia: docs/plans/02a-modelo-de-items.md (Decisiones de partida y 2a.1).
--
-- La app se ve igual: el relleno da a cada ítem el tipo de su lista de siempre.

-- ─── Tipo ───────────────────────────────────────────────────────────────────────
-- `note` es lo de «En mente»: aún sin tipo. `sublist` llega en 2a.3 (ADR-010).
create type public.item_kind as enum ('note', 'task', 'shopping', 'event');

-- El tipo con el que nace un ítem en una lista de ese tipo. `custom` no tiene listas todavía (la
-- «Personalizada» nunca se activó); sus ítems serían tareas hasta que lleguen los campos propios.
create or replace function public.default_item_kind(p_kind public.list_kind)
returns public.item_kind language sql immutable set search_path = '' as $$
  select case p_kind
    when 'inbox'    then 'note'::public.item_kind
    when 'tasks'    then 'task'::public.item_kind
    when 'shopping' then 'shopping'::public.item_kind
    when 'events'   then 'event'::public.item_kind
    else 'task'::public.item_kind
  end
$$;

-- Estados de cada tipo; el primero es el inicial (el cliente tiene la misma tabla en
-- `features/items/status.ts`).
create or replace function public.item_statuses(p_kind public.item_kind)
returns text[] language sql immutable set search_path = '' as $$
  select case p_kind
    when 'note'     then array['pending', 'done']
    when 'task'     then array['pending', 'in_progress', 'done']
    when 'shopping' then array['pending', 'bought', 'discarded']
    when 'event'    then array['upcoming', 'cancelled']
  end
$$;

create or replace function public.is_final_status(p_status text)
returns boolean language sql immutable set search_path = '' as $$
  select p_status in ('done', 'bought', 'discarded', 'cancelled')
$$;

-- El estado de un ítem al cambiar de tipo: si existe en el tipo nuevo, se queda; si no, lo
-- terminado pasa al primer final del tipo y lo demás, al inicial. La misma regla que tenía
-- `translateStatus` al mover entre listas (03 §items).
create or replace function public.translate_item_status(p_status text, p_kind public.item_kind)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_status = any (public.item_statuses(p_kind)) then p_status
    when public.is_final_status(p_status) then coalesce(
      (select s from unnest(public.item_statuses(p_kind)) as s where public.is_final_status(s) limit 1),
      (public.item_statuses(p_kind))[1])
    else (public.item_statuses(p_kind))[1]
  end
$$;

-- ─── Columna y relleno, en tres pasos ──────────────────────────────────────────
-- 1. La columna nace admitiendo nulos: así el `alter` no tiene que inventar un valor para las
--    filas que ya existen.
alter table public.items add column kind public.item_kind;

-- 2. Cada ítem toma el tipo de la lista en la que está hoy. Los triggers de `items` no deben
--    intervenir en el relleno (no es un cambio de usuario: ni `updated_at` ni validaciones), así
--    que se apagan solo durante este `update`.
alter table public.items disable trigger user;
update public.items i
   set kind = public.default_item_kind(l.kind)
  from public.lists l
 where l.id = i.list_id;
alter table public.items enable trigger user;

-- 3. Con todas las filas rellenas, ya puede ser obligatoria. Sin valor por defecto a propósito: si
--    un cliente no lo manda (una versión vieja de la PWA en caché), lo pone `items_validate` con el
--    tipo por defecto de la lista. Los `not null` se comprueban después de los triggers `before`.
alter table public.items alter column kind set not null;

-- ─── Validación por tipo de ítem ───────────────────────────────────────────────
-- Reemplaza la de la migración inicial: el estado se valida por `new.kind`, no por `lists.kind`.
-- Sigue sin `security definer`: si la lista es ajena, RLS la oculta y falla con «no encontrada».
create or replace function public.items_validate()
returns trigger language plpgsql set search_path = '' as $$
declare
  lk public.list_kind;
begin
  select kind into lk from public.lists where id = new.list_id;

  if lk is null then
    raise exception 'Lista % no encontrada', new.list_id;
  end if;

  if new.kind is null then
    new.kind := public.default_item_kind(lk);
  end if;

  if not (new.status = any (public.item_statuses(new.kind))) then
    raise exception 'Estado % no válido para un ítem de tipo %', new.status, new.kind;
  end if;

  if public.is_final_status(new.status) then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ─── «En mente» es siempre «sin tipo» ──────────────────────────────────────────
-- Una `note` que sale de una inbox toma el tipo por defecto de su destino, con su estado traducido
-- («leche», movida a Compras, es una compra). Lo que entra en una inbox vuelve a ser `note` (una
-- tarea en curso llega pendiente, como hasta ahora). Entre dos listas normales el tipo no cambia.
-- Va en la base y no en el cliente por lo mismo que `items_track_inbox`: cualquier forma de mover
-- (hoja, menú, deslizar, un atajo futuro) se comporta igual.
--
-- Los triggers `before` de una tabla se ejecutan por orden alfabético: `items_adopt_kind` va antes
-- que `items_validate`, que ya ve el tipo y el estado nuevos.
create or replace function public.items_adopt_kind()
returns trigger language plpgsql set search_path = '' as $$
declare
  to_kind public.list_kind;
begin
  if new.list_id is not distinct from old.list_id then
    return new;
  end if;

  select kind into to_kind from public.lists where id = new.list_id;
  if to_kind is null then
    return new;
  end if;

  if to_kind = 'inbox' then
    new.kind := 'note';
  elsif new.kind = 'note' then
    new.kind := public.default_item_kind(to_kind);
  else
    return new;
  end if;

  new.status := public.translate_item_status(new.status, new.kind);
  return new;
end $$;

create trigger items_adopt_kind before update of list_id on public.items
  for each row execute function public.items_adopt_kind();

-- ─── Contadores por tipo de ítem ───────────────────────────────────────────────
-- Igual que en `list_counters_view`, pero lo que depende del tipo mira el del ítem: un evento
-- pasado sin repetición cuenta como hecho aunque siga en `upcoming`, y el total pendiente de
-- compras suma las compras, estén en la lista que estén.
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < now())))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (i.kind = 'event' and i.recurrence is null and i.due_at < now())))::integer
    as done_count,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null), 0))::integer
    as pending_price_cents
from public.lists l
left join public.items i on i.list_id = l.id
group by l.id;
