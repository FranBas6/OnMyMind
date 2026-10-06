-- Sesión 3.2 · Compartir una lista (plan 03-fase-3: decisiones 2 y 3, y §Compartir: lo que hay que
-- tocar; 03 §list_members). Desde la 1.1 todas las políticas pasan por `is_list_member`, así que
-- leer y escribir los ítems de una lista compartida ya funciona en cuanto hay una fila aceptada en
-- `list_members`. Lo que falta es todo lo que la fase 2 dio por hecho con una sola persona:
--
-- - Invitar a alguien que quizá aún no tiene cuenta: `list_members` exige su `user_id`. Las
--   invitaciones van aparte, con un enlace que vale 7 días para quien lo abra (diseño 20).
-- - Quien entra puede con los ítems, no con la lista (decisión 2): editar la lista, solo quien la
--   creó. Y nadie se mete en `list_members` si no es aceptando una invitación.
-- - El orden de Inicio es de cada uno: el de quien entra va en su fila de `list_members`.
-- - Las fotos se ven si las usa un ítem de una lista tuya (hoy, solo las de tu carpeta).
-- - Lo que añadiste en la lista de otro se queda si borras tu cuenta.
-- - La limpieza de fotos y los avisos miran todos los ítems, no solo los que ve quien la lanza.

-- ─── Editar la lista, solo quien la creó ──────────────────────────────────────────────────────

drop policy lists_update on public.lists;
create policy lists_update on public.lists for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ─── Miembros: entrar solo aceptando, salir uno mismo, quitar quien la creó ──────────────────

-- La posición de la lista en el Inicio de quien entra (la de quien la creó sigue en `lists`).
alter table public.list_members add column position integer not null default 1000;

-- Antes: quien creó la lista hacía de todo con sus miembros, también meter a cualquiera sin
-- preguntar. Ahora entrar es `accept_list_invite`; aquí solo se sale o se quita.
drop policy members_manage on public.list_members;
create policy members_remove on public.list_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.lists l
               where l.id = list_id and l.owner_id = (select auth.uid()))
  );

-- ─── Invitaciones ─────────────────────────────────────────────────────────────────────────────

-- Un enlace que vale para quien lo abra durante 7 días, hasta que se anule (diseño 20: el enlace
-- sigue activo después de que alguien entre). El token va en claro porque quien creó la lista
-- tiene que poder copiar otra vez el enlace activo; solo él lo lee, y lo único que da es entrar
-- en esa lista. Son 12 caracteres (72 bits al azar) para que el enlace sea corto: `/i/k7Q2xpA9zL3m`.
create table public.list_invites (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  token        text not null unique,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  revoked_at   timestamptz
);

create index list_invites_list_idx on public.list_invites (list_id);

alter table public.list_invites enable row level security;

-- Solo quien creó la lista ve sus invitaciones. Crearlas, anularlas y aceptarlas va por funciones.
create policy list_invites_select on public.list_invites for select to authenticated
  using (exists (select 1 from public.lists l
                 where l.id = list_id and l.owner_id = (select auth.uid())));

-- El enlace activo de una lista (sin anular y sin caducar) o uno nuevo.
create or replace function public.create_list_invite(p_list_id uuid)
returns table (invite_token text, invite_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  l record;
begin
  select owner_id, kind into l from public.lists where id = p_list_id;
  if not found or uid is null or l.owner_id <> uid then
    raise exception 'Solo quien creó la lista puede invitar.' using errcode = '42501';
  end if;
  if l.kind = 'inbox' then
    raise exception '«En mente» no se comparte.' using errcode = '42501';
  end if;

  return query
    select i.token, i.expires_at from public.list_invites i
    where i.list_id = p_list_id and i.revoked_at is null and i.expires_at > now()
    order by i.created_at desc
    limit 1;
  if found then
    return;
  end if;

  return query
    insert into public.list_invites as i (list_id, token, created_by)
    values (p_list_id,
            translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
            uid)
    returning i.token, i.expires_at;
end
$$;

-- Anula el enlace activo de una lista. Quien ya entró sigue dentro.
create or replace function public.revoke_list_invite(p_list_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.lists l
                 where l.id = p_list_id and l.owner_id = (select auth.uid())) then
    raise exception 'Solo quien creó la lista puede anular su enlace.' using errcode = '42501';
  end if;
  update public.list_invites i set revoked_at = now()
  where i.list_id = p_list_id and i.revoked_at is null;
end
$$;

-- Cómo está una invitación, para la pantalla del enlace. También sin sesión: «Fran te invita a
-- «Compras»» sale antes de entrar o de crear la cuenta. De un enlace que no existe no dice nada.
-- Estados: `valid`, `expired`, `revoked`, `member` (ya estás en la lista, desde `member_since`),
-- `own` (es tu lista) y `unknown`. Con la lista, su tipo y cuántas cosas tiene por hacer
-- («Una lista de compras con 7 cosas», diseño 20, J2).
create or replace function public.list_invite_preview(p_token text)
returns table (status text, list_id uuid, list_name text, list_color text,
               list_kind public.list_kind, pending_count integer, inviter_name text,
               member_since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv record;
  joined timestamptz;
begin
  select i.list_id, i.expires_at, i.revoked_at, l.name, l.color, l.kind, l.owner_id,
         l.archived_at, p.display_name
    into inv
  from public.list_invites i
  join public.lists l on l.id = i.list_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;

  if not found then
    return query select 'unknown'::text, null::uuid, null::text, null::text,
                        null::public.list_kind, null::integer, null::text, null::timestamptz;
    return;
  end if;

  if uid is not null then
    select m.accepted_at into joined from public.list_members m
    where m.list_id = inv.list_id and m.user_id = uid and m.accepted_at is not null;
  end if;

  return query select
    case
      when uid is not null and inv.owner_id = uid then 'own'
      when joined is not null then 'member'
      when inv.revoked_at is not null or inv.archived_at is not null then 'revoked'
      when inv.expires_at <= now() then 'expired'
      else 'valid'
    end,
    inv.list_id, inv.name, inv.color, inv.kind,
    (select count(*)::integer from public.items it
     where it.list_id = inv.list_id and it.completed_at is null and it.kind <> 'sublist'),
    inv.display_name, joined;
end
$$;

-- Entrar en la lista con un enlace. Devuelve el mismo estado que la vista previa (`joined` si ha
-- entrado ahora) y la lista. La lista nueva se coloca al final del Inicio de quien entra.
create or replace function public.accept_list_invite(p_token text)
returns table (status text, list_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv record;
  next_position integer;
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;

  select i.list_id, i.expires_at, i.revoked_at, l.owner_id, l.archived_at
    into inv
  from public.list_invites i
  join public.lists l on l.id = i.list_id
  where i.token = p_token;

  if not found then
    return query select 'unknown'::text, null::uuid;
    return;
  end if;
  if inv.owner_id = uid then
    return query select 'own'::text, inv.list_id;
    return;
  end if;
  if exists (select 1 from public.list_members m
             where m.list_id = inv.list_id and m.user_id = uid and m.accepted_at is not null) then
    return query select 'member'::text, inv.list_id;
    return;
  end if;
  -- Una lista archivada no se ofrece: para los demás, ha desaparecido.
  if inv.revoked_at is not null or inv.archived_at is not null then
    return query select 'revoked'::text, inv.list_id;
    return;
  end if;
  if inv.expires_at <= now() then
    return query select 'expired'::text, inv.list_id;
    return;
  end if;

  select coalesce(greatest(
           (select max(l.position) from public.lists l
            where l.owner_id = uid and l.archived_at is null),
           (select max(m.position) from public.list_members m where m.user_id = uid)
         ), 0) + 1000
    into next_position;

  insert into public.list_members (list_id, user_id, role, accepted_at, position)
  values (inv.list_id, uid, 'editor', now(), next_position)
  on conflict on constraint list_members_pkey
    do update set accepted_at = now(), position = excluded.position;

  return query select 'joined'::text, inv.list_id;
end
$$;

-- Quién está en una lista tuya o compartida contigo: quien la creó y quienes han entrado. Los
-- perfiles siguen siendo privados (ajustes incluidos); de los demás solo sale esto.
-- `joined_at`: cuándo entró («Entró el 3 oct»); `null` en quien la creó.
create or replace function public.list_people(p_list_id uuid)
returns table (user_id uuid, display_name text, avatar_url text, is_owner boolean,
               joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_url, true, null::timestamptz
  from public.lists l join public.profiles p on p.id = l.owner_id
  where l.id = p_list_id and public.is_list_member(p_list_id)
  union all
  select p.id, p.display_name, p.avatar_url, false, m.accepted_at
  from public.list_members m join public.profiles p on p.id = m.user_id
  where m.list_id = p_list_id and m.accepted_at is not null and public.is_list_member(p_list_id)
  order by 4 desc, 5
$$;

-- ─── El orden de Inicio, de cada uno ──────────────────────────────────────────────────────────

-- Las listas como las ve quien pregunta: con su orden y si es quien la creó. Las archivadas de
-- otros no salen: archivar es cosa de quien la creó, y para los demás la lista desaparece.
create view public.my_lists with (security_invoker = true) as
select
  l.id, l.name, l.color, l.icon, l.kind, l.archived_at, l.owner_id,
  coalesce(m.position, l.position) as position,
  l.owner_id = (select auth.uid()) as is_owner
from public.lists l
left join public.list_members m
  on m.list_id = l.id and m.user_id = (select auth.uid()) and m.accepted_at is not null
where l.owner_id = (select auth.uid())
   or (m.user_id is not null and l.archived_at is null);

-- Guardar el orden a mano (2.9): en `lists` lo tuyo, en tu fila de `list_members` lo compartido
-- contigo. `[{ "id": …, "position": … }]`.
create or replace function public.set_list_positions(p_changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  update public.lists l set position = c.position
  from jsonb_to_recordset(p_changes) as c(id uuid, position integer)
  where l.id = c.id and l.owner_id = uid;

  update public.list_members m set position = c.position
  from jsonb_to_recordset(p_changes) as c(id uuid, position integer)
  where m.list_id = c.id and m.user_id = uid;
end
$$;

-- ─── Fotos: se ven si las usa un ítem de una lista tuya ───────────────────────────────────────

create index items_image_path_idx on public.items (image_path) where image_path is not null;

-- La foto (o su miniatura, `…-thumb.ext`) la usa algún ítem de una lista en la que estás.
create or replace function public.can_see_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items i
    where i.image_path = regexp_replace(p_name, '-thumb(\.[a-z0-9]+)$', '\1', 'i')
      and public.is_list_member(i.list_id)
  )
$$;

drop policy item_images_select on storage.objects;
create policy item_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.can_see_photo(name))
  );

-- Con compartir, `orphan_photos` como invocador solo vería tus ítems y daría por huérfana una foto
-- tuya que sigue en una lista de la que saliste. Sigue mirando solo tu carpeta, pero contra todos.
alter function public.orphan_photos() security definer;

-- ─── Avisos: si el otro cambia la fecha, tu aviso relativo se mueve ───────────────────────────

alter function public.items_sync_reminders() security definer;

-- ─── Borrar una cuenta no se lleva lo añadido en listas de otros ──────────────────────────────

-- `items.created_by` borra en cascada: sin esto, al borrar tu cuenta desaparecería lo que
-- añadiste en la lista de otro. Pasa a nombre de quien creó esa lista. Tus fotos se borran con
-- tu cuenta (2.8), así que los ítems de listas ajenas que las usaban se quedan sin ella.
create or replace function public.profiles_hand_over_items()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.items i set created_by = l.owner_id
  from public.lists l
  where i.list_id = l.id and i.created_by = old.id and l.owner_id <> old.id;

  update public.items i set image_path = null
  from public.lists l
  where i.list_id = l.id and l.owner_id <> old.id
    and i.image_path like old.id::text || '/%';

  return old;
end
$$;

create trigger profiles_hand_over_items before delete on public.profiles
  for each row execute function public.profiles_hand_over_items();

-- ─── Permisos de las funciones ────────────────────────────────────────────────────────────────

revoke execute on function public.create_list_invite(uuid) from public, anon;
revoke execute on function public.revoke_list_invite(uuid) from public, anon;
revoke execute on function public.list_invite_preview(text) from public;
revoke execute on function public.accept_list_invite(text) from public, anon;
revoke execute on function public.list_people(uuid) from public, anon;
revoke execute on function public.set_list_positions(jsonb) from public, anon;
revoke execute on function public.can_see_photo(text) from public, anon;
revoke execute on function public.profiles_hand_over_items() from public, anon, authenticated;

grant execute on function public.create_list_invite(uuid) to authenticated;
grant execute on function public.revoke_list_invite(uuid) to authenticated;
grant execute on function public.list_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_list_invite(text) to authenticated;
grant execute on function public.list_people(uuid) to authenticated;
grant execute on function public.set_list_positions(jsonb) to authenticated;
grant execute on function public.can_see_photo(text) to authenticated;
