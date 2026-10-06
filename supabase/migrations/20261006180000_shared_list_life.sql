-- Sesión 3.3 · Una lista compartida en el día a día (plan 03-fase-3; diseño 20, M2, M6, M9 y M10).
--
-- - Quién completó cada cosa (`items.completed_by`): en «Fuera de la cabeza» sale la inicial de
--   quien lo hizo, si no fuiste tú (decisión de Fran, 2026-10-06).
-- - Por qué desapareció una lista que tenías (`list_departures`): te quitaron, quien la creó la
--   borró o la archivó. Para quien la tenía abierta las tres cosas se ven igual (RLS se la oculta),
--   así que se deja constancia en el momento y la pantalla lo puede decir.
-- - Quién está en cada lista compartida, de una vez (`shared_list_people`), para las iniciales de
--   tarjetas, sidebar, cabecera, filas y Hoy.

-- ─── Quién completó cada cosa ────────────────────────────────────────────────────────────────

alter table public.items
  add column completed_by uuid references public.profiles (id) on delete set null;

-- Hasta hoy cada cuenta era de una persona: lo hecho lo hizo quien lo creó.
update public.items set completed_by = created_by where completed_at is not null;

-- La de `items_kind` (2a.1), con quién completa: al pasar a un estado final se apunta quien lo
-- hace; al volver a pendiente se olvida, como `completed_at`.
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
    if new.completed_at is null then
      new.completed_by := coalesce((select auth.uid()), new.completed_by);
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ─── Por qué desapareció una lista ───────────────────────────────────────────────────────────

-- Una fila por lista y persona, con lo último que pasó. Sin clave foránea a la lista: si se borró,
-- ya no está. Se lee solo la tuya; la escriben los triggers.
create table public.list_departures (
  list_id      uuid not null,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reason       text not null check (reason in ('removed', 'deleted', 'archived')),
  list_name    text not null,
  owner_name   text,
  happened_at  timestamptz not null default now(),
  primary key (list_id, user_id)
);

alter table public.list_departures enable row level security;

create policy list_departures_select on public.list_departures for select to authenticated
  using (user_id = (select auth.uid()));

-- Apunta a quienes entraron en una lista (no a quien la creó) qué le pasó.
create or replace function public.note_list_departure(p_list_id uuid, p_reason text,
                                                      p_user_id uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.list_departures (list_id, user_id, reason, list_name, owner_name)
  select l.id, m.user_id, p_reason, l.name, p.display_name
  from public.lists l
  join public.list_members m on m.list_id = l.id and m.accepted_at is not null
  left join public.profiles p on p.id = l.owner_id
  where l.id = p_list_id and (p_user_id is null or m.user_id = p_user_id)
  on conflict (list_id, user_id) do update
    set reason = excluded.reason, list_name = excluded.list_name,
        owner_name = excluded.owner_name, happened_at = now()
$$;

-- Quien la creó la borra (también al borrar su cuenta): para los demás, `deleted`. Antes de
-- borrar, que es cuando aún se sabe quién estaba.
create or replace function public.lists_note_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.note_list_departure(old.id, 'deleted');
  return old;
end $$;

create trigger lists_note_deleted before delete on public.lists
  for each row execute function public.lists_note_deleted();

-- La archiva: para los demás desaparece (`archived`); si la desarchiva, vuelve y se olvida.
create or replace function public.lists_note_archived()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null then
    perform public.note_list_departure(new.id, 'archived');
  else
    delete from public.list_departures d where d.list_id = new.id and d.reason = 'archived';
  end if;
  return null;
end $$;

create trigger lists_note_archived after update of archived_at on public.lists
  for each row when (old.archived_at is distinct from new.archived_at)
  execute function public.lists_note_archived();

-- Te quitan (`removed`). Salir por tu cuenta no deja nada: ya sabes por qué. Si la lista ya no está
-- (se borró y esto es la cascada), lo dice `lists_note_deleted`.
create or replace function public.members_note_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.accepted_at is not null and old.user_id is distinct from (select auth.uid()) then
    insert into public.list_departures (list_id, user_id, reason, list_name, owner_name)
    select l.id, old.user_id, 'removed', l.name, p.display_name
    from public.lists l left join public.profiles p on p.id = l.owner_id
    where l.id = old.list_id
    on conflict (list_id, user_id) do update
      set reason = excluded.reason, list_name = excluded.list_name,
          owner_name = excluded.owner_name, happened_at = now();
  end if;
  return null;
end $$;

create trigger members_note_removed after delete on public.list_members
  for each row execute function public.members_note_removed();

-- Si vuelves a entrar, lo de antes ya no cuenta.
create or replace function public.members_forget_departure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.accepted_at is not null then
    delete from public.list_departures d where d.list_id = new.list_id and d.user_id = new.user_id;
  end if;
  return null;
end $$;

create trigger members_forget_departure after insert or update of accepted_at
  on public.list_members
  for each row execute function public.members_forget_departure();

-- ─── Quién está en cada lista compartida ─────────────────────────────────────────────────────

-- Las listas tuyas o compartidas contigo en las que hay alguien más, con quién: quien la creó y
-- quienes entraron. Como `list_people`, pero todas a la vez (las iniciales de Inicio, el sidebar,
-- las filas y Hoy). De los demás perfiles solo sale el nombre.
create or replace function public.shared_list_people()
returns table (list_id uuid, user_id uuid, display_name text, avatar_url text,
               is_owner boolean, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with shared as (
    select l.id, l.owner_id
    from public.lists l
    where public.is_list_member(l.id)
      and exists (select 1 from public.list_members m
                  where m.list_id = l.id and m.accepted_at is not null)
  )
  select s.id, p.id, p.display_name, p.avatar_url, true, null::timestamptz
  from shared s join public.profiles p on p.id = s.owner_id
  union all
  select s.id, p.id, p.display_name, p.avatar_url, false, m.accepted_at
  from shared s
  join public.list_members m on m.list_id = s.id and m.accepted_at is not null
  join public.profiles p on p.id = m.user_id
  order by 1, 5 desc, 6
$$;

-- ─── Permisos de las funciones ───────────────────────────────────────────────────────────────

revoke execute on function public.note_list_departure(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.lists_note_deleted() from public, anon, authenticated;
revoke execute on function public.lists_note_archived() from public, anon, authenticated;
revoke execute on function public.members_note_removed() from public, anon, authenticated;
revoke execute on function public.members_forget_departure() from public, anon, authenticated;
revoke execute on function public.shared_list_people() from public, anon;
grant execute on function public.shared_list_people() to authenticated;
