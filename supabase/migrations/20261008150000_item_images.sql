-- Sesión 4.5 · Varias fotos (plan 04-fase-4, diseño 23, D).
--
-- Una cosa puede tener hasta 10 fotos propias, en orden. Viven en `item_images`, también cuando
-- solo hay una: las de ahora (`items.image_path`) pasan aquí. `items.image_path` sigue siendo la
-- primera, y la mantiene el trigger `item_images_sync`, como `item_links_sync` con las tiendas:
-- así la fila, Hoy, Buscar, las bajadas de precio y la miniatura no cambian. Con alguna foto
-- propia, la imagen de la web (`image_url`) deja de valer, como en la 2a.6.
--   · RLS por la lista, como las tiendas: lo de una foto lo toca quien puede tocar su cosa.
--   · Los archivos siguen en `item-images`, en la carpeta de quien los subió. Una foto se puede
--     compartir entre dos cosas (duplicar una sublista copia la ruta): `orphan_photos` mira si la
--     usa alguna, en `items` o aquí, antes de darla por huérfana.
--   · `can_see_photo` deja ver también las que no son la primera, por pertenencia a la lista.
--   · `duplicate_list` devuelve todas las fotos de cada cosa, para copiarlas.
-- Además, `item_links_sync` pasa a `security definer`: al borrar un usuario desde Studio, la
-- cascada corría con el rol del servicio de auth y fallaba al leer `items` (encontrado en la 4.4).
-- Referencia: docs/concept/03-modelo-de-datos.md §item_images.

create table public.item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  path        text not null check (char_length(path) <= 500),
  position    integer not null default 1000,
  created_at  timestamptz not null default now()
);

create index item_images_item_idx on public.item_images (item_id, position);
create index item_images_path_idx on public.item_images (path);

alter table public.item_images enable row level security;

create policy item_images_select on public.item_images for select to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_images.item_id and public.is_list_member(i.list_id)));
create policy item_images_insert on public.item_images for insert to authenticated
  with check (exists (select 1 from public.items i
                      where i.id = item_images.item_id and public.is_list_member(i.list_id)));
create policy item_images_update on public.item_images for update to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_images.item_id and public.is_list_member(i.list_id)))
  with check (exists (select 1 from public.items i
                      where i.id = item_images.item_id and public.is_list_member(i.list_id)));
create policy item_images_delete on public.item_images for delete to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_images.item_id and public.is_list_member(i.list_id)));

-- Las de ahora: la foto de cada cosa es su primera.
insert into public.item_images (item_id, path, position, created_at)
select i.id, i.image_path, 1000, i.updated_at from public.items i where i.image_path is not null;

-- ─── Como mucho 10 ────────────────────────────────────────────────────────────────────────────
create or replace function public.item_images_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.item_images where item_id = new.item_id) >= 10 then
    raise exception 'Como mucho 10 fotos por cosa' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger item_images_limit before insert on public.item_images
  for each row execute function public.item_images_limit();

-- ─── La primera es la de la cosa ──────────────────────────────────────────────────────────────
-- Siempre actualiza la cosa, aunque la primera no cambie: así su `updated_at` cambia y el directo
-- (3.4) avisa a los demás de que hay una foto nueva. `security definer` porque solo toca la cosa de
-- la foto, que quien la cambió ya podía tocar, y para que una cascada como la de borrar un usuario
-- no dependa del rol con el que corre.
create or replace function public.item_images_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item_id uuid := coalesce(new.item_id, old.item_id);
  v_first text;
begin
  -- La cosa ya no existe (se está borrando con sus fotos).
  if not exists (select 1 from public.items where id = v_item_id) then
    return null;
  end if;
  select path into v_first from public.item_images
  where item_id = v_item_id order by position, created_at, id limit 1;
  if v_first is null then
    update public.items set image_path = null where id = v_item_id;
  else
    update public.items set image_path = v_first, image_url = null where id = v_item_id;
  end if;
  return null;
end $$;

create trigger item_images_sync after insert or update or delete on public.item_images
  for each row execute function public.item_images_sync();

alter function public.item_links_sync() security definer;

-- ─── Las fotos de los demás y las huérfanas ───────────────────────────────────────────────────
create or replace function public.can_see_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  with photo as (select regexp_replace(p_name, '-thumb(\.[a-z0-9]+)$', '\1', 'i') as path)
  select exists (
    select 1 from public.items i, photo
    where i.image_path = photo.path and public.is_list_member(i.list_id)
  ) or exists (
    select 1 from public.item_images g join public.items i on i.id = g.item_id, photo
    where g.path = photo.path and public.is_list_member(i.list_id)
  )
$$;

create or replace function public.orphan_photos()
returns setof text language sql stable security definer set search_path = '' as $$
  with paths as (
    select i.image_path as path from public.items i where i.image_path is not null
    union
    select g.path from public.item_images g
  ),
  used as (
    select path as name from paths
    union all
    select regexp_replace(path, '(\.[a-z0-9]+)$', '-thumb\1', 'i') from paths
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-images'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
    and o.created_at < now() - interval '10 minutes'
    and not exists (select 1 from used u where u.name = o.name)
  order by o.name
$$;

-- ─── Duplicar: todas las fotos ────────────────────────────────────────────────────────────────
-- Igual que en la 4.4, pero `photos` lleva todas las de cada cosa, con su orden, para copiarlas.
create or replace function public.duplicate_list(p_list_id uuid, p_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  source public.lists;
  copy_id uuid := gen_random_uuid();
  v_name text := btrim(p_name);
  ids jsonb;
  next_position integer;
  copied integer;
  photos jsonb;
begin
  if uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  select * into source from public.lists where id = p_list_id;
  if source.id is null then
    raise exception 'Lista % no encontrada', p_list_id using errcode = 'P0002';
  end if;
  if source.kind = 'inbox' then
    raise exception 'En mente no se duplica' using errcode = '22023';
  end if;

  select coalesce(greatest(
           (select max(l.position) from public.lists l
            where l.owner_id = uid and l.archived_at is null),
           (select max(m.position) from public.list_members m where m.user_id = uid)
         ), 0) + 1000
    into next_position;

  insert into public.lists (id, owner_id, name, color, icon, kind, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.field_schema,
          next_position);

  select coalesce(jsonb_object_agg(i.id, gen_random_uuid()), '{}') into ids
  from public.items i where i.list_id = p_list_id;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, null, i.title, i.notes,
         (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is null
  order by i.position;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, (ids ->> i.parent_id::text)::uuid,
         i.title, i.notes, (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is not null
  order by i.position;

  insert into public.item_links (item_id, url, url_title, url_site, price_cents, currency,
                                 price_source, price_checked_at, price_followed, position)
  select (ids ->> k.item_id::text)::uuid, k.url, k.url_title, k.url_site, k.price_cents,
         k.currency, k.price_source, k.price_checked_at, k.price_followed, k.position
  from public.item_links k
  join public.items i on i.id = k.item_id
  where i.list_id = p_list_id;

  select count(*) into copied
  from public.items i where i.list_id = copy_id and i.kind <> 'sublist';

  select coalesce(jsonb_agg(jsonb_build_object('item_id', (ids ->> i.id::text)::uuid,
                                               'path', g.path, 'position', g.position)
                            order by i.position, g.position), '[]')
    into photos
  from public.item_images g join public.items i on i.id = g.item_id
  where i.list_id = p_list_id;

  return jsonb_build_object('list_id', copy_id, 'items', copied, 'photos', photos);
end $$;
