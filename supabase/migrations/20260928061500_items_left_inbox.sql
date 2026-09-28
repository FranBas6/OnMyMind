-- Sesión 1.8 · Rastro de lo que sale de «En mente».
--
-- En la inbox, lo que se mueve a otra lista también cuenta como «fuera de la cabeza» (diseño
-- `06 Detalle de tarea` y `05 Detalle de lista`): se ve tachado, con «movida a Casa · lunes».
-- Como el ítem cambia de `list_id`, hay que guardar de qué inbox salió y cuándo.

-- ─── Columnas ───────────────────────────────────────────────────────────────────
-- `left_inbox_id`: la inbox de la que salió (no basta con un booleano: en fase 3, con listas
-- compartidas, un ítem puede venir de la inbox de otra persona y no debe salir en la tuya).
-- Si esa inbox desaparece (se borra la cuenta), se pone a null y el rastro se pierde.
alter table public.items
  add column left_inbox_id uuid references public.lists (id) on delete set null,
  add column left_inbox_at timestamptz;

-- La sección de la inbox pide «lo que salió de esta inbox», lo más reciente primero.
create index items_left_inbox_idx on public.items (left_inbox_id, left_inbox_at desc)
  where left_inbox_id is not null;

-- ─── Trigger ────────────────────────────────────────────────────────────────────
-- Lo pone la base, no el cliente, para que cualquier forma de mover (hoja, menú, deslizar, un
-- futuro atajo) deje el mismo rastro:
--   · sale de una inbox          → guarda esa inbox y la hora;
--   · vuelve a una inbox         → se borra el rastro (vuelve a estar «en mente»);
--   · pasa entre otras dos listas → el rastro se conserva («movida a Trabajo» tras Casa).
-- Sin `security definer`: lee `lists` con los permisos de quien mueve, que ve las dos listas.
create or replace function public.items_track_inbox()
returns trigger language plpgsql set search_path = '' as $$
declare
  from_inbox boolean;
  to_inbox boolean;
begin
  if new.list_id is not distinct from old.list_id then
    return new;
  end if;

  select kind = 'inbox' into from_inbox from public.lists where id = old.list_id;
  select kind = 'inbox' into to_inbox from public.lists where id = new.list_id;

  if coalesce(to_inbox, false) then
    new.left_inbox_id := null;
    new.left_inbox_at := null;
  elsif coalesce(from_inbox, false) then
    new.left_inbox_id := old.list_id;
    new.left_inbox_at := now();
  end if;

  return new;
end $$;

create trigger items_track_inbox before update of list_id on public.items
  for each row execute function public.items_track_inbox();
