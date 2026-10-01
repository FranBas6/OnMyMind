-- Sesión 2a.6 · Una foto y un enlace en cualquier ítem (plan 02a, diseño 15).
--
-- `items.url` e `items.image_url` ya existían (promocionadas para compras, ADR-004). Ahora las usa
-- cualquier ítem:
--   · `url`: el enlace; `url_title`, el título de su página (null = aún no se ha buscado; '' = se
--     buscó y la página no da título, así no se vuelve a pedir cada vez).
--   · `image_url`: la imagen de la página enlazada, sin descargarla (03 §Storage, «De la web»).
--   · `image_path`: la foto propia, subida al bucket `item-images`. Si la hay, manda sobre
--     `image_url`.
-- Referencia: docs/plans/02a-modelo-de-items.md (2a.6) y 03 §Storage.

alter table public.items
  add column url_title text check (char_length(url_title) <= 300),
  add column image_path text check (char_length(image_path) <= 300);

-- ─── Fotos ──────────────────────────────────────────────────────────────────────
-- Privado: se sirven con URLs firmadas. Ruta `{user_id}/{item_id}/{uuid}.webp` y su miniatura
-- `{uuid}-thumb.webp`, que genera el cliente (las transformaciones de Storage son del plan Pro).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Cada uno, solo en su carpeta (el primer segmento de la ruta es su id).
create policy item_images_select on storage.objects for select to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy item_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy item_images_update on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy item_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
