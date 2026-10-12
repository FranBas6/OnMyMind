-- Sesión 5.7 · Notas protegidas (ADR-013, diseño 26).
--   · Una nota protegida guarda su texto cifrado en el aparato (AES-GCM con la clave de la caja de
--     la 5.6): `sealed_notes` y su vector `sealed_iv`, con `notes` vacío. La primera línea
--     (`title`) se sigue viendo en la lista: lo dice la app al protegerla.
--   · `sealed_key_id` es con qué clave de la caja se cifró (`private_vaults.key_id`). Si se crea
--     otra porque se olvidó, las de antes se quedan sin poder abrirse: la app lo sabe comparando.
--   · Solo notas, sin fotos ni enlaces, y no en una lista compartida: los demás no tienen tu
--     clave. Por lo mismo, una lista con protegidas no se comparte.
--   · Duplicar copia lo cifrado tal cual: es la misma persona con la misma clave.
-- Referencia: docs/concept/decisiones/ADR-013-que-protege-lo-privado.md y docs/plans/05-fase-5.md
-- (5.7).

-- ─── Las columnas ────────────────────────────────────────────────────────────────────────────

alter table public.items
  add column protected boolean not null default false,
  add column sealed_notes text,
  add column sealed_iv text,
  add column sealed_key_id uuid;

comment on column public.items.protected is
  'Nota protegida (5.7): su texto va cifrado en sealed_notes y notes está vacío.';
comment on column public.items.sealed_notes is
  'El texto de una nota protegida, cifrado en el aparato (AES-GCM, base64). La base no lo lee.';
comment on column public.items.sealed_key_id is
  'Con qué clave de la caja se cifró (private_vaults.key_id).';

-- Protegida: nota, sin texto en claro ni foto ni enlace, y con lo cifrado. Si no, nada cifrado.
-- (El texto, hasta 5000 caracteres, cabe cifrado en 30 000: base64 de hasta 4 bytes cada uno.)
alter table public.items
  add constraint items_protected_check check (
    case when protected
      then kind = 'note' and notes is null and url is null and image_url is null
           and image_path is null and sealed_notes is not null and sealed_iv is not null
           and sealed_key_id is not null
      else sealed_notes is null and sealed_iv is null and sealed_key_id is null
    end),
  add constraint items_sealed_notes_check check (char_length(sealed_notes) between 24 and 30000),
  add constraint items_sealed_iv_check check (char_length(sealed_iv) between 12 and 32);

-- ─── Dónde no ────────────────────────────────────────────────────────────────────────────────

-- Si la lista tiene a alguien más dentro.
create function public.list_is_shared(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.list_members m where m.list_id = p_list_id and m.accepted_at is not null)
$$;

revoke execute on function public.list_is_shared(uuid) from public, anon;
grant execute on function public.list_is_shared(uuid) to authenticated;

-- Una protegida no está en una lista compartida, y lo que se cifra de nuevo es con la clave de la
-- caja de ahora de quien tiene la lista (no con la de antes de crear otra). Restaurar o duplicar
-- (un `insert`) lleva lo cifrado tal cual, con la clave que tenía.
create function public.items_protected_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.list_is_shared(new.list_id) then
    raise exception 'En una lista compartida no se puede proteger' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.sealed_notes is distinct from old.sealed_notes
     and not exists (
       select 1 from public.private_vaults v
       join public.lists l on l.owner_id = v.user_id
       where l.id = new.list_id and v.key_id = new.sealed_key_id) then
    raise exception 'Ese texto no es de tu clave privada de ahora' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger items_protected_before
  before insert or update on public.items
  for each row when (new.protected)
  execute function public.items_protected_before();

-- Fotos y enlaces, de momento no (C6d): una protegida es solo texto.
create function public.item_parts_not_protected()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.items i where i.id = new.item_id and i.protected) then
    raise exception 'Una nota protegida es solo texto' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger item_images_not_protected
  before insert on public.item_images
  for each row execute function public.item_parts_not_protected();

create trigger item_links_not_protected
  before insert on public.item_links
  for each row execute function public.item_parts_not_protected();

-- ─── Compartir ───────────────────────────────────────────────────────────────────────────────

-- Si la lista tiene notas protegidas (C9b): entonces no se comparte.
create function public.list_has_protected(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.items i where i.list_id = p_list_id and i.protected)
$$;

revoke execute on function public.list_has_protected(uuid) from public, anon;
grant execute on function public.list_has_protected(uuid) to authenticated;

-- Invitar: como en la 3.2, y antes, que no tenga protegidas.
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
  if public.list_has_protected(p_list_id) then
    raise exception 'Una lista con notas protegidas no se comparte.' using errcode = '42501';
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

-- Unirse: un enlace de antes de proteger algo ya no vale (para quien entra, como si se hubiera
-- dejado de compartir).
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
  -- Una lista archivada, o con notas protegidas, no se ofrece.
  if inv.revoked_at is not null or inv.archived_at is not null
     or public.list_has_protected(inv.list_id) then
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

-- ─── Duplicar ────────────────────────────────────────────────────────────────────────────────

-- Como en la 5.3, y las protegidas con lo cifrado tal cual.
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

  insert into public.lists (id, owner_id, name, color, icon, kind, view, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.view,
          source.field_schema, next_position);

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

  return jsonb_build_object('list_id', copy_id, 'items', copied, 'photos', photos);
end $$;

revoke execute on function public.duplicate_list(uuid, text) from public, anon;
grant execute on function public.duplicate_list(uuid, text) to authenticated;
