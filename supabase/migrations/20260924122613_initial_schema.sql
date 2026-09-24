-- Migración inicial: perfiles, listas, ítems, miembros, triggers y RLS.
-- Referencia: docs/concept/03-modelo-de-datos.md. item_prices, reminders, push_subscriptions
-- y Storage llegan en migraciones aditivas en su fase (08 · B.15).

-- ─── Tipos enumerados ──────────────────────────────────────────────────────────

create type public.list_kind as enum ('inbox', 'tasks', 'shopping', 'events', 'custom');
create type public.member_role as enum ('owner', 'editor');

-- ─── profiles ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── lists ─────────────────────────────────────────────────────────────────────

create table public.lists (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  color         text not null default 'indigo'
                check (color in ('coral', 'amber', 'teal', 'blue', 'pink', 'green', 'indigo')),
  icon          text,                       -- null = inicial del nombre
  kind          public.list_kind not null default 'tasks',
  field_schema  jsonb,                      -- null en tipos base; obligatorio en 'custom'
  position      integer not null default 1000,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lists_custom_needs_schema
    check (kind <> 'custom' or field_schema is not null)
);

-- Solo una lista inbox por usuario
create unique index lists_one_inbox_per_owner
  on public.lists (owner_id) where kind = 'inbox';

create index lists_owner_idx on public.lists (owner_id, archived_at, position);

-- ─── items ─────────────────────────────────────────────────────────────────────

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lists (id) on delete cascade,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  notes         text check (char_length(notes) <= 5000),
  status        text not null default 'pending',
  fields        jsonb not null default '{}'::jsonb,
  position      integer not null default 1000,

  -- Promocionados desde el tipo para poder consultarlos entre listas
  due_at        timestamptz,                -- fecha límite (tasks) o fecha del evento (events)
  all_day       boolean not null default false,
  recurrence    text check (recurrence in ('daily', 'weekly', 'monthly', 'yearly')),
  price_cents   integer check (price_cents >= 0),
  currency      text default 'EUR' check (char_length(currency) = 3),
  url           text,
  image_url     text,

  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index items_list_idx on public.items (list_id, position);

-- Hoy: pendientes con fecha de cualquier lista a la que tengas acceso (RLS filtra por usuario)
create index items_due_idx on public.items (due_at)
  where due_at is not null and completed_at is null;

-- ─── list_members (se usa en fase 3; existe ya para que las políticas la contemplen) ──

create table public.list_members (
  list_id        uuid not null references public.lists (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  role           public.member_role not null default 'editor',
  invited_email  text,
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- ─── updated_at ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger lists_set_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

-- ─── Validación de estado y completed_at de los ítems ─────────────────────────

create or replace function public.items_validate()
returns trigger language plpgsql set search_path = '' as $$
declare
  k public.list_kind;
begin
  select kind into k from public.lists where id = new.list_id;

  if k is null then
    raise exception 'Lista % no encontrada', new.list_id;
  end if;

  if not (
    (k = 'inbox'    and new.status in ('pending', 'done')) or
    (k = 'tasks'    and new.status in ('pending', 'in_progress', 'done')) or
    (k = 'shopping' and new.status in ('pending', 'bought', 'discarded')) or
    (k = 'events'   and new.status in ('upcoming', 'cancelled')) or
    (k = 'custom'   and new.status in ('pending', 'done'))
  ) then
    raise exception 'Estado % no válido para una lista de tipo %', new.status, k;
  end if;

  if new.status in ('done', 'bought', 'discarded', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger items_validate before insert or update on public.items
  for each row execute function public.items_validate();

-- ─── Protección de la inbox y del propietario (08 · B.7) ─────────────────────

create or replace function public.lists_protect_inbox()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- Al borrar la cuenta, la cascada auth.users → profiles → lists llega con el perfil ya
    -- borrado: entonces sí se deja borrar la inbox.
    if old.kind = 'inbox'
       and exists (select 1 from public.profiles p where p.id = old.owner_id) then
      raise exception 'La lista En mente no se puede borrar';
    end if;
    return old;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar el propietario de una lista';
  end if;

  if old.kind = 'inbox' then
    if new.kind is distinct from old.kind then
      raise exception 'La lista En mente no puede cambiar de tipo';
    end if;
    if new.archived_at is not null then
      raise exception 'La lista En mente no se puede archivar';
    end if;
  end if;

  return new;
end $$;

create trigger lists_protect_inbox before update or delete on public.lists
  for each row execute function public.lists_protect_inbox();

-- ─── Pertenencia a una lista: la usan todas las políticas ─────────────────────

create or replace function public.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id and l.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.list_members m
    where m.list_id = p_list_id
      and m.user_id = (select auth.uid())
      and m.accepted_at is not null
  );
$$;

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.items        enable row level security;
alter table public.list_members enable row level security;

-- profiles: cada uno ve y edita el suyo; crearlo y borrarlo es cosa de los triggers y cascadas
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- lists: leer y editar si eres miembro; crear y borrar solo el propietario
create policy lists_select on public.lists for select to authenticated
  using (public.is_list_member(id));
create policy lists_insert on public.lists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy lists_update on public.lists for update to authenticated
  using (public.is_list_member(id)) with check (public.is_list_member(id));
create policy lists_delete on public.lists for delete to authenticated
  using (owner_id = (select auth.uid()));

-- items: todo pasa por la lista; solo al crear se exige que created_by sea quien inserta
create policy items_select on public.items for select to authenticated
  using (public.is_list_member(list_id));
create policy items_insert on public.items for insert to authenticated
  with check (public.is_list_member(list_id) and created_by = (select auth.uid()));
create policy items_update on public.items for update to authenticated
  using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));
create policy items_delete on public.items for delete to authenticated
  using (public.is_list_member(list_id));

-- list_members: ver los de tus listas; gestionarlos solo el propietario
create policy members_select on public.list_members for select to authenticated
  using (public.is_list_member(list_id));
create policy members_manage on public.list_members for all to authenticated
  using (exists (
    select 1 from public.lists l
    where l.id = list_id and l.owner_id = (select auth.uid())
  ));

-- ─── Alta de usuario: perfil, "En mente" y tres listas de ejemplo ─────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inbox_id uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.lists (owner_id, name, color, kind, position)
  values (new.id, 'En mente', 'indigo', 'inbox', 1000)
  returning id into inbox_id;

  insert into public.lists (owner_id, name, color, kind, position) values
    (new.id, 'Casa',    'coral', 'tasks',    2000),
    (new.id, 'Compras', 'blue',  'shopping', 3000),
    (new.id, 'Agenda',  'amber', 'events',   4000);

  update public.profiles
  set settings = jsonb_build_object('default_list_id', inbox_id, 'timezone', 'Europe/Madrid')
  where id = new.id;

  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
