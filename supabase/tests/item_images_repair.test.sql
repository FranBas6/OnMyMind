-- Arreglo 4.7b: una foto que solo estaba en `items.image_path` (guardada por la 4.4 después de
-- la migración de la 4.5) pasa a `item_images`. La migración ya corrió, así que aquí se repite
-- su `insert` sobre una cosa preparada así. En una transacción que se deshace. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a47b-00000000000a'''
\set casa  '''00000000-0000-4000-a47b-0000000000a1'''
\set suelta '''00000000-0000-4000-a47b-0000000000d1'''
\set bien  '''00000000-0000-4000-a47b-0000000000d2'''
\set foto  '''00000000-0000-4000-a47b-00000000000a/suelta/foto.webp'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values (:ana, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'ana-47b@example.com', '{}', '{"full_name": "Ana"}', now(), now());

insert into public.lists (id, owner_id, name, color, kind, position)
values (:casa, :ana, 'Casa', 'coral', 'tasks', 2000);
insert into public.items (id, list_id, created_by, kind, title, status, position)
values (:suelta, :casa, :ana, 'task', 'Descripción en barra', 'pending', 1000),
       (:bien, :casa, :ana, 'task', 'Con su foto', 'pending', 2000);
-- Como la 4.4: la ruta en la cosa, sin fila en `item_images` (el trigger no corre al revés).
update public.items set image_path = :foto where id = :suelta;
insert into public.item_images (item_id, path, position)
values (:bien, '00000000-0000-4000-a47b-00000000000a/bien/foto.webp', 1000);

select is((select count(*)::integer from public.item_images where item_id = :suelta), 0,
  'antes: la foto solo está en la cosa');

insert into public.item_images (item_id, path, position, created_at)
select i.id, i.image_path,
       coalesce((select min(g.position) from public.item_images g where g.item_id = i.id), 2000)
         - 1000,
       i.updated_at
from public.items i
where i.image_path is not null
  and not exists (select 1 from public.item_images g
                  where g.item_id = i.id and g.path = i.image_path);

select results_eq(
  format('select path, position from public.item_images where item_id = %L', :suelta),
  format('values (%L::text, 1000)', :foto),
  'después: es su primera foto');
select is((select image_path from public.items where id = :suelta), :foto,
  'y la cosa sigue con la misma');
select is((select count(*)::integer from public.item_images where item_id = :bien), 1,
  'lo que ya estaba bien no cambia');

select * from finish(true);
rollback;
