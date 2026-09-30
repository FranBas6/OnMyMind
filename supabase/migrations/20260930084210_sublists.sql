-- Sesión 2a.3 · Sublistas en la base (ADR-010, opción A: una sublista es un ítem que se abre).
--
-- Una sublista es un ítem de tipo `sublist` («Lisboa» dentro de «Viajes»). Lo de dentro son ítems
-- normales de la misma lista con `parent_id` apuntando a ella: un árbol en la propia tabla (lista
-- de adyacencia) de un solo nivel. Los hijos repiten `list_id`, así que la RLS no cambia
-- (`is_list_member(list_id)`) y las consultas por lista no tienen que subir al padre.
-- Referencia: docs/plans/02a-modelo-de-items.md (2a.3) y ADR-010 §Decisión.

-- ─── Columna ────────────────────────────────────────────────────────────────────
-- Borrar una sublista borra lo de dentro (la confirmación con recuento la pone el cliente).
alter table public.items
  add column parent_id uuid references public.items (id) on delete cascade;

-- Lo de dentro de una sublista, en su orden (la pantalla de la sublista y los contadores).
create index items_parent_idx on public.items (parent_id, position)
  where parent_id is not null;

-- ─── Estados de la sublista ─────────────────────────────────────────────────────
-- Pendiente · En curso · Pausada · Hecha (decisión de Fran). `paused` no es final: una sublista
-- pausada no baja a «Fuera de la cabeza», pero lo de dentro se calla (ver los contadores).
create or replace function public.item_statuses(p_kind public.item_kind)
returns text[] language sql immutable set search_path = '' as $$
  select case p_kind
    when 'note'     then array['pending', 'done']
    when 'task'     then array['pending', 'in_progress', 'done']
    when 'shopping' then array['pending', 'bought', 'discarded']
    when 'event'    then array['upcoming', 'cancelled']
    when 'sublist'  then array['pending', 'in_progress', 'paused', 'done']
  end
$$;

-- Si lo de dentro de una sublista cuenta (sale en Hoy y en los contadores): solo mientras está
-- pendiente o en curso. Pausada o hecha, se calla (ADR-010).
create or replace function public.is_active_sublist_status(p_status text)
returns boolean language sql immutable set search_path = '' as $$
  select p_status in ('pending', 'in_progress')
$$;

-- ─── Validación del árbol ───────────────────────────────────────────────────────
-- Se ejecuta después de `items_validate` (orden alfabético de los triggers `before`), que ya ha
-- fijado el tipo y el estado. Sin `security definer`: lee con los permisos de quien escribe.
--   · una sublista no vive en «En mente» ni dentro de otra sublista (un solo nivel);
--   · el padre es una sublista de la misma lista;
--   · mover un ítem de dentro a otra lista lo saca de la sublista (se queda como ítem normal);
--   · una sublista con cosas dentro no puede pasar a ser otra cosa.
create or replace function public.items_validate_parent()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent_kind public.item_kind;
  parent_list uuid;
  list_kind public.list_kind;
begin
  if new.kind = 'sublist' then
    if new.parent_id is not null then
      raise exception 'Una sublista no puede estar dentro de otra';
    end if;
    select kind into list_kind from public.lists where id = new.list_id;
    if list_kind = 'inbox' then
      raise exception 'En mente no admite sublistas';
    end if;
  end if;

  if new.parent_id is not null then
    select kind, list_id into parent_kind, parent_list from public.items where id = new.parent_id;
    if parent_kind is null then
      raise exception 'Sublista % no encontrada', new.parent_id;
    end if;
    if parent_kind <> 'sublist' then
      raise exception 'Solo se puede meter algo dentro de una sublista';
    end if;
    if parent_list <> new.list_id then
      if tg_op = 'UPDATE' and new.list_id <> old.list_id
         and new.parent_id is not distinct from old.parent_id then
        new.parent_id := null;
      else
        raise exception 'Lo de dentro de una sublista tiene que estar en su misma lista';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.kind = 'sublist' and new.kind <> 'sublist'
     and exists (select 1 from public.items where parent_id = new.id) then
    raise exception 'Una sublista con cosas dentro no puede cambiar de tipo';
  end if;

  return new;
end $$;

create trigger items_validate_parent before insert or update on public.items
  for each row execute function public.items_validate_parent();

-- ─── Lo de dentro sigue a su sublista ───────────────────────────────────────────
-- Al mover una sublista a otra lista, lo de dentro se va con ella. Es un trigger `after`: la
-- sublista ya está en la lista nueva cuando se actualizan sus hijos, así que la validación de
-- cada hijo ve padre e hijo en la misma lista.
create or replace function public.items_follow_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'sublist' and new.list_id is distinct from old.list_id then
    update public.items set list_id = new.list_id where parent_id = new.id;
  end if;
  return null;
end $$;

create trigger items_follow_parent after update of list_id on public.items
  for each row execute function public.items_follow_parent();

-- ─── Contadores ─────────────────────────────────────────────────────────────────
-- La tarjeta de la lista suma todo lo pendiente, también lo de dentro de sus sublistas activas
-- («Develop · 12 pendientes»). La sublista en sí no cuenta (es un contenedor), y lo de dentro de
-- una sublista pausada o hecha no cuenta ni como pendiente ni como hecho: está callado.
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
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;
