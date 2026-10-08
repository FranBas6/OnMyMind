-- Sesión 4.4 · Duplicar una lista (plan 04-fase-4, diseño 23, C).
--
-- «Duplicar» en el menú ··· de una lista hace una copia para usarla de plantilla («Maleta de viaje»,
-- «Compra semanal»). Va en la base, en una función, para que sea de una vez y no deje copias a
-- medias. Es `security invoker`: copia lo que quien la llama puede ver, y la copia es suya.
--   · Se copian la lista (nombre nuevo, color, icono y tipo) y todo lo de dentro, sublistas
--     incluidas, con ids nuevos: títulos, notas, tipos, prioridades, enlaces, fotos de la web,
--     tiendas, precios y repeticiones. Todo vuelve a su estado inicial (pendiente o próximo).
--   · No se copian las fechas ni los avisos (en una plantilla suelen haber pasado), ni quién
--     completó, ni el rastro de «En mente», ni con quién se comparte: la copia es solo tuya. Ni el
--     histórico de precios: la copia empieza el suyo con el precio de ahora.
--   · Las fotos subidas (`image_path`) no se pueden compartir entre dos ítems: cambiar la de uno
--     borraría la del otro (`orphan_photos`). La copia nace sin ella y la función dice cuáles eran;
--     la app copia el archivo en Storage, a tu carpeta, y se la pone.
--   · Se puede duplicar una lista archivada (la copia sale entre las tuyas) y una compartida
--     contigo. «En mente» no.
-- Devuelve `{ list_id, items, photos: [{ item_id, path }] }`: la copia, cuántas cosas tiene (sin
-- contar las sublistas) y las fotos que faltan por copiar.

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
  -- Por RLS, solo se ve si es tuya o estás en ella.
  select * into source from public.lists where id = p_list_id;
  if source.id is null then
    raise exception 'Lista % no encontrada', p_list_id using errcode = 'P0002';
  end if;
  if source.kind = 'inbox' then
    raise exception 'En mente no se duplica' using errcode = '22023';
  end if;

  -- Al final de tus listas, como al unirte a una compartida.
  select coalesce(greatest(
           (select max(l.position) from public.lists l
            where l.owner_id = uid and l.archived_at is null),
           (select max(m.position) from public.list_members m where m.user_id = uid)
         ), 0) + 1000
    into next_position;

  insert into public.lists (id, owner_id, name, color, icon, kind, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.field_schema,
          next_position);

  -- Un id nuevo por cada ítem, para que lo de dentro siga a su sublista.
  select coalesce(jsonb_object_agg(i.id, gen_random_uuid()), '{}') into ids
  from public.items i where i.list_id = p_list_id;

  -- Primero las sublistas y lo suelto, después lo de dentro: `items_validate_parent` busca a la
  -- madre al insertar cada fila.
  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, null, i.title, i.notes,
         (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         -- Con varias tiendas, el precio lo pone `item_links_sync` al copiarlas.
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

  -- Las tiendas, con ids nuevos. Llegan todas en la misma sentencia: `item_links_sync` ya ve dos
  -- o más y le pone a cada compra el enlace de la primera y el precio de la más barata.
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
                                               'path', i.image_path)), '[]')
    into photos
  from public.items i where i.list_id = p_list_id and i.image_path is not null;

  return jsonb_build_object('list_id', copy_id, 'items', copied, 'photos', photos);
end $$;

revoke execute on function public.duplicate_list(uuid, text) from public, anon;
grant execute on function public.duplicate_list(uuid, text) to authenticated;
