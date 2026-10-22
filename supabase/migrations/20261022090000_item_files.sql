-- Sesión 6.1 · Documentos (plan 06-fase-6, diseño 29).
--
-- Una cosa puede llevar hasta 5 documentos (PDF, Word, Excel, PowerPoint, texto y CSV) de 5 MB
-- como mucho, en orden, como las fotos de la 4.5:
--   · `item_files`, gemela de `item_images`, con el nombre, el tipo y el tamaño para enseñarlos
--     sin abrir el archivo (también sin conexión, con la cosa en la caché).
--   · RLS por la lista: lo de un documento lo toca quien puede tocar su cosa, también en las
--     compartidas.
--   · El bucket `item-files`, privado, con el tamaño y los tipos en el propio bucket: la nube los
--     rechaza aunque la app no los compruebe. Cada uno escribe en su carpeta, y lee los de las
--     listas en las que está (`can_see_file`).
--   · Una nota protegida no lleva documentos (no se cifran), y una nota con documentos no se
--     protege.
--   · Los huérfanos (`orphan_files`), borrar la cuenta (`own_files`, y `delete_own_account` no
--     sigue si queda alguno) y duplicar (`duplicate_list` devuelve los de cada cosa para copiarlos),
--     como con las fotos.
-- Referencia: docs/plans/06-fase-6.md (6.1) y docs/concept/03-modelo-de-datos.md §item_files.

-- ─── Los tipos ────────────────────────────────────────────────────────────────────────────────
-- Los mismos en la tabla y en el bucket. La app pone el tipo por la extensión cuando el sistema no
-- lo dice (en el iPhone, un .docx puede llegar sin tipo).
create function public.item_file_types()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
$$;

-- ─── La tabla ─────────────────────────────────────────────────────────────────────────────────
create table public.item_files (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  path        text not null check (char_length(path) <= 500),
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  mime        text not null check (mime = any (public.item_file_types())),
  size_bytes  integer not null check (size_bytes between 1 and 5242880),
  position    integer not null default 1000,
  created_at  timestamptz not null default now()
);

comment on table public.item_files is
  'Los documentos de una cosa (6.1): hasta 5, de 5 MB, en el bucket item-files.';

create index item_files_item_idx on public.item_files (item_id, position);
create index item_files_path_idx on public.item_files (path);

alter table public.item_files enable row level security;

create policy item_files_select on public.item_files for select to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_files.item_id and public.is_list_member(i.list_id)));
create policy item_files_insert on public.item_files for insert to authenticated
  with check (exists (select 1 from public.items i
                      where i.id = item_files.item_id and public.is_list_member(i.list_id)));
create policy item_files_update on public.item_files for update to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_files.item_id and public.is_list_member(i.list_id)))
  with check (exists (select 1 from public.items i
                      where i.id = item_files.item_id and public.is_list_member(i.list_id)));
create policy item_files_delete on public.item_files for delete to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_files.item_id and public.is_list_member(i.list_id)));

-- ─── Como mucho 5, y no en una nota protegida ─────────────────────────────────────────────────
create function public.item_files_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.item_files where item_id = new.item_id) >= 5 then
    raise exception 'Como mucho 5 documentos por cosa' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger item_files_limit before insert on public.item_files
  for each row execute function public.item_files_limit();

-- La de las fotos y los enlaces (5.7): una protegida es solo texto.
create trigger item_files_not_protected before insert on public.item_files
  for each row execute function public.item_parts_not_protected();

-- Y al revés: una nota con documentos no se protege (P2). Las fotos y los enlaces ya lo impiden con
-- `items_protected_check` (están en la propia cosa); los documentos, no.
create function public.items_protected_without_files()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.item_files f where f.item_id = new.id) then
    raise exception 'Una nota con documentos no se protege' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger items_protected_without_files
  before update of protected on public.items
  for each row when (new.protected and not old.protected)
  execute function public.items_protected_without_files();

-- ─── El directo ───────────────────────────────────────────────────────────────────────────────
-- Un documento nuevo o quitado toca su cosa, para que su `updated_at` cambie y el directo (3.4)
-- avise a los demás, como `item_images_sync` con las fotos. `security definer` por lo mismo que
-- allí: solo toca la cosa del documento, y no depende del rol de una cascada.
create function public.item_files_touch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.items set updated_at = now() where id = coalesce(new.item_id, old.item_id);
  return null;
end $$;

create trigger item_files_touch after insert or delete on public.item_files
  for each row execute function public.item_files_touch();

-- ─── El bucket ────────────────────────────────────────────────────────────────────────────────
-- Privado: se abren con un enlace firmado. Ruta `{user_id}/{item_id}/{uuid}.{ext}`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-files', 'item-files', false, 5242880, public.item_file_types())
on conflict (id) do nothing;

-- Los documentos de una lista en la que estás, aunque los subiera otro.
create function public.can_see_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.item_files f join public.items i on i.id = f.item_id
    where f.path = p_name and public.is_list_member(i.list_id)
  )
$$;

revoke execute on function public.can_see_file(text) from public, anon;
grant execute on function public.can_see_file(text) to authenticated;

create policy item_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'item-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.can_see_file(name))
  );
create policy item_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy item_files_update on storage.objects for update to authenticated
  using (bucket_id = 'item-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy item_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─── Huérfanos y borrar la cuenta ─────────────────────────────────────────────────────────────
-- Como `orphan_photos`: los de tu carpeta que no usa ningún documento, contra todas las listas (una
-- copia comparte archivo hasta que se copia, y una lista de la que saliste lo sigue usando). Lo
-- subido hace menos de 10 minutos no cuenta: puede que aún se esté guardando.
create function public.orphan_files()
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-files'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
    and o.created_at < now() - interval '10 minutes'
    and not exists (select 1 from public.item_files f where f.path = o.name)
  order by o.name
$$;

-- Todos los de tu carpeta, para borrarlos antes de la cuenta.
create function public.own_files()
returns setof text language sql stable set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-files'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
  order by o.name
$$;

revoke execute on function public.orphan_files() from public, anon;
revoke execute on function public.own_files() from public, anon;
grant execute on function public.orphan_files() to authenticated;
grant execute on function public.own_files() to authenticated;

-- Como en la 2.8, ahora también con los documentos: si queda alguno, no sigue.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id in ('item-images', 'item-files')
      and (storage.foldername(o.name))[1] = uid::text
  ) then
    raise exception 'Aún quedan fotos o documentos por borrar.' using errcode = '55000';
  end if;
  delete from auth.users u where u.id = uid;
end
$$;

-- ─── Duplicar: también los documentos ─────────────────────────────────────────────────────────
-- Igual que en la 5.8, y `files` lleva los de cada cosa, con su orden, para copiarlos (6.2).
create or replace function public.duplicate_list(p_list_id uuid, p_name text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  source public.lists;
  copy_id uuid := gen_random_uuid();
  v_name text := btrim(p_name);
  ids jsonb;
  next_position integer;
  copied integer;
  photos jsonb;
  files jsonb;
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

  insert into public.lists (id, owner_id, name, color, icon, kind, view, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.view,
          source.field_schema, next_position);

  if public.is_hidden_list(p_list_id) then
    insert into public.hidden_lists (user_id, list_id) values (uid, copy_id);
  end if;

  select coalesce(jsonb_object_agg(i.id, gen_random_uuid()), '{}') into ids
  from public.items i where i.list_id = p_list_id;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed, choose_one, protected, sealed_notes, sealed_iv, sealed_key_id)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, null, i.title, i.notes,
         (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed, i.choose_one, i.protected, i.sealed_notes, i.sealed_iv, i.sealed_key_id
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is null
  order by i.position;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed, protected, sealed_notes, sealed_iv, sealed_key_id)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, (ids ->> i.parent_id::text)::uuid,
         i.title, i.notes, (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed, i.protected, i.sealed_notes, i.sealed_iv, i.sealed_key_id
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

  select coalesce(jsonb_agg(jsonb_build_object('item_id', (ids ->> i.id::text)::uuid,
                                               'path', f.path, 'name', f.name, 'mime', f.mime,
                                               'size_bytes', f.size_bytes,
                                               'position', f.position)
                            order by i.position, f.position), '[]')
    into files
  from public.item_files f join public.items i on i.id = f.item_id
  where i.list_id = p_list_id;

  return jsonb_build_object('list_id', copy_id, 'items', copied, 'photos', photos,
                            'files', files);
end $$;

