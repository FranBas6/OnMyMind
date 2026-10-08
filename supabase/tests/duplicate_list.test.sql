-- Sesión 4.4 · Duplicar una lista: la copia es tuya, con todo pendiente, sin fechas, avisos ni
-- personas; las sublistas siguen con lo suyo, las compras con sus tiendas y la más barata, y las
-- fotos subidas se devuelven para copiarlas. Ana tiene «Maleta de viaje», archivada; Bea comparte
-- «Compras» con Ana; Carlos no tiene nada que ver. En una transacción que se deshace al final.
-- `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a440-00000000000a'''
\set bea    '''00000000-0000-4000-a440-00000000000b'''
\set carlos '''00000000-0000-4000-a440-00000000000c'''
\set maleta '''00000000-0000-4000-a440-0000000000a1'''
\set casa   '''00000000-0000-4000-a440-0000000000a2'''
\set compras '''00000000-0000-4000-a440-0000000000b1'''
\set docs   '''00000000-0000-4000-a440-0000000000d1'''
\set dni    '''00000000-0000-4000-a440-0000000000d2'''
\set crema  '''00000000-0000-4000-a440-0000000000d3'''
\set cargador '''00000000-0000-4000-a440-0000000000d4'''
\set neceser '''00000000-0000-4000-a440-0000000000d5'''
\set adaptador '''00000000-0000-4000-a440-0000000000d6'''
\set pc     '''00000000-0000-4000-a440-0000000000e1'''
\set mm     '''00000000-0000-4000-a440-0000000000e2'''
\set leche  '''00000000-0000-4000-a440-0000000000f1'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-44@example.com', 'Ana'), (:bea, 'bea-44@example.com', 'Bea'),
             (:carlos, 'carlos-44@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a440-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a440-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a440-00000000000c''); set local role authenticated;'

-- ─── La maleta de Ana ────────────────────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, icon, kind, position) values
  (:maleta, :ana, 'Maleta de viaje', 'teal', 'suitcase', 'tasks', 5000),
  (:casa, :ana, 'Casa', 'coral', null, 'tasks', 2000);

insert into public.items (id, list_id, created_by, kind, parent_id, title, notes, status, fields,
                          position, due_at, all_day, recurrence, url, url_title, url_site,
                          image_url, image_path) values
  (:docs, :maleta, :ana, 'sublist', null, 'Documentación', null, 'in_progress', '{}', 1000,
   null, false, null, null, null, null, null, null),
  (:cargador, :maleta, :ana, 'task', null, 'Cargador del móvil', 'El de USB-C', 'done',
   '{"priority": "high"}', 2000, now() - interval '3 days', true, 'FREQ=WEEKLY;BYDAY=FR',
   null, null, null, null, null),
  (:neceser, :maleta, :ana, 'task', null, 'Neceser', null, 'pending', '{}', 3000, null, false,
   null, null, null, null, null, null),
  (:adaptador, :maleta, :ana, 'shopping', null, 'Adaptador de enchufe', null, 'pending', '{}',
   4000, null, false, null, 'https://www.amazon.es/adaptador', 'Adaptador', 'Amazon',
   'https://m.media-amazon.com/adaptador.jpg', null);
-- La foto subida, en `item_images` desde la 4.5.
insert into public.item_images (item_id, path, position)
values (:neceser, :ana || '/' || :neceser || '/foto.webp', 1000);
insert into public.items (id, list_id, created_by, kind, parent_id, title, status, position,
                          due_at, all_day) values
  (:dni, :maleta, :ana, 'task', :docs, 'Renovar el DNI', 'done', 1000, now() + interval '9 days',
   true);
insert into public.items (id, list_id, created_by, kind, title, status, position, url, url_site,
                          price_cents, price_source) values
  (:crema, :maleta, :ana, 'shopping', 'Crema solar', 'pending', 5000,
   'https://www.pccomponentes.com/crema', 'PcComponentes', 1295, 'web');
-- Dos tiendas: la más barata es MediaMarkt; Ana la compró en PcComponentes, la cara.
insert into public.item_links (id, item_id, url, url_site, price_cents, price_source, position)
values (:pc, :crema, 'https://www.pccomponentes.com/crema', 'PcComponentes', 1295, 'web', 1000),
       (:mm, :crema, 'https://www.mediamarkt.es/crema', 'MediaMarkt', 995, 'web', 2000);
update public.items set status = 'bought', price_cents = 1295, price_link_id = :pc,
       price_store = 'PcComponentes'
where id = :crema;
insert into public.reminders (item_id, user_id, remind_at, offset_minutes)
values (:dni, :ana, now() + interval '8 days', 1440);
update public.lists set archived_at = now() where id = :maleta;

select public.duplicate_list(:maleta, '  Maleta de viaje (2)  ') as result \gset
select :'result'::jsonb ->> 'list_id' as copy \gset

select results_eq(
  format('select name, color, icon, kind::text, owner_id, archived_at is null from public.lists where id = %L', :'copy'),
  $$values ('Maleta de viaje (2)', 'teal', 'suitcase', 'tasks', '00000000-0000-4000-a440-00000000000a'::uuid, true)$$,
  'la copia es de Ana, con el nombre nuevo sin espacios, su color e icono, y no está archivada');
select ok((select position from public.lists where id = :'copy'::uuid) > 2000,
  'y va al final de sus listas');
select is((:'result'::jsonb ->> 'items')::integer, 5, 'cinco cosas, sin contar la sublista');
select results_eq(
  format($$select title, kind::text, status, due_at is null, completed_at is null
           from public.items where list_id = %L order by position, title$$, :'copy'),
  $$values ('Documentación', 'sublist', 'pending', true, true),
           ('Renovar el DNI', 'task', 'pending', true, true),
           ('Cargador del móvil', 'task', 'pending', true, true),
           ('Neceser', 'task', 'pending', true, true),
           ('Adaptador de enchufe', 'shopping', 'pending', true, true),
           ('Crema solar', 'shopping', 'pending', true, true)$$,
  'todo pendiente y sin fechas');
select results_eq(
  format($$select notes, fields ->> 'priority', recurrence from public.items
           where list_id = %L and title = 'Cargador del móvil'$$, :'copy'),
  $$values ('El de USB-C', 'high', 'FREQ=WEEKLY;BYDAY=FR')$$,
  'con sus notas, prioridad y repetición');
select is(
  (select p.title from public.items c join public.items p on p.id = c.parent_id
   where c.list_id = :'copy'::uuid and c.title = 'Renovar el DNI'),
  'Documentación', 'lo de dentro sigue en su sublista');
select is(
  (select p.list_id from public.items c join public.items p on p.id = c.parent_id
   where c.list_id = :'copy'::uuid and c.title = 'Renovar el DNI'),
  :'copy'::uuid, 'la de la copia, no la original');
select results_eq(
  format($$select url, url_site, image_url from public.items
           where list_id = %L and title = 'Adaptador de enchufe'$$, :'copy'),
  $$values ('https://www.amazon.es/adaptador', 'Amazon', 'https://m.media-amazon.com/adaptador.jpg')$$,
  'el enlace y la foto de la web van con ella');

-- Las tiendas.
select results_eq(
  format($$select k.url_site, k.price_cents from public.item_links k
           join public.items i on i.id = k.item_id
           where i.list_id = %L order by k.position$$, :'copy'),
  $$values ('PcComponentes', 1295), ('MediaMarkt', 995)$$,
  'la compra con varias tiendas las lleva todas');
select ok(
  (select bool_and(k.id not in (:pc, :mm)) from public.item_links k
   join public.items i on i.id = k.item_id where i.list_id = :'copy'::uuid),
  'con ids nuevos');
select results_eq(
  format($$select i.price_cents, i.price_store, k.url_site from public.items i
           join public.item_links k on k.id = i.price_link_id
           where i.list_id = %L and i.title = 'Crema solar'$$, :'copy'),
  $$values (995, 'MediaMarkt', 'MediaMarkt')$$,
  'y, como ya no está comprada, cuenta la más barata');

-- Las fotos subidas.
select is(
  (select image_path from public.items where list_id = :'copy'::uuid and title = 'Neceser'), null,
  'la foto subida no se comparte: la copia nace sin ella');
select is(
  (:'result'::jsonb -> 'photos'),
  jsonb_build_array(jsonb_build_object(
    'item_id', (select id from public.items where list_id = :'copy'::uuid and title = 'Neceser'),
    'path', '00000000-0000-4000-a440-00000000000a/00000000-0000-4000-a440-0000000000d5/foto.webp',
    'position', 1000)),
  'y la función dice cuál era, para que la app la copie');

-- Lo que no se copia.
select is_empty(
  format($$select 1 from public.reminders r join public.items i on i.id = r.item_id
           where i.list_id = %L$$, :'copy'),
  'sin avisos');
select is_empty(format('select 1 from public.list_members where list_id = %L', :'copy'),
  'ni personas');

-- La original, como estaba.
select results_eq(
  format('select archived_at is not null from public.lists where id = %L', :maleta),
  $$values (true)$$, 'la original sigue archivada');
select results_eq(
  format('select status from public.items where id in (%L, %L) order by title', :dni, :crema),
  $$values ('bought'), ('done')$$, 'y con lo hecho y comprado');
select is((select count(*)::integer from public.item_links where item_id = :crema), 2,
  'y con sus dos tiendas');

select throws_ok(format('select public.duplicate_list(%L, %L)',
                        (select id from public.lists where kind = 'inbox' and owner_id = :ana), 'Otra'),
  '22023', null, '«En mente» no se duplica');
select throws_ok(format('select public.duplicate_list(%L, %L)', :maleta, ''),
  '23514', null, 'sin nombre, no');

-- ─── Una compartida con Ana ─────────────────────────────────────────────────────────────────

:as_bea
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :bea, 'Compras', 'blue', 'shopping', 1000);
insert into public.items (id, list_id, created_by, kind, title, status, position)
values (:leche, :compras, :bea, 'shopping', 'Leche de avena', 'bought', 1000);
reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:compras, :ana, 'editor', now(), 3000);

:as_ana
select public.duplicate_list(:compras, 'Compras de Bea') as shared \gset
select results_eq(
  format($$select l.owner_id, i.title, i.status from public.lists l
           join public.items i on i.list_id = l.id where l.id = %L$$,
         :'shared'::jsonb ->> 'list_id'),
  $$values ('00000000-0000-4000-a440-00000000000a'::uuid, 'Leche de avena', 'pending')$$,
  'Ana duplica la de Bea: la copia es suya, con lo de dentro pendiente');

:as_bea
select is_empty(format('select 1 from public.lists where id = %L', :'shared'::jsonb ->> 'list_id'),
  'Bea no ve la copia de Ana');
select results_eq(format('select status from public.items where id = %L', :leche),
  $$values ('bought')$$, 'y su lista no cambia');

:as_carlos
select throws_ok(format('select public.duplicate_list(%L, %L)', :maleta, 'Mía'),
  'P0002', null, 'Carlos no puede duplicar lo que no ve');

reset role;
set local role anon;
select throws_ok(format('select public.duplicate_list(%L, %L)', :maleta, 'Mía'),
  '42501', null, 'ni sin sesión');

select * from finish(true);
rollback;
