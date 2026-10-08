-- Sesión 4.5 · Varias fotos: la primera es la de la cosa, el orden manda, como mucho 10, las ven
-- los de la lista, las huérfanas tienen en cuenta todas, duplicar las devuelve todas y borrar un
-- usuario desde Studio ya no falla (`item_links_sync` como su dueño). Ana tiene «Cocina», compartida con Bea; Carlos no tiene nada
-- que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a450-00000000000a'''
\set bea    '''00000000-0000-4000-a450-00000000000b'''
\set carlos '''00000000-0000-4000-a450-00000000000c'''
\set cocina '''00000000-0000-4000-a450-0000000000a1'''
\set reforma '''00000000-0000-4000-a450-0000000000d1'''
\set grifo  '''00000000-0000-4000-a450-0000000000d2'''
\set f1 '''00000000-0000-4000-a450-0000000000f1'''
\set f2 '''00000000-0000-4000-a450-0000000000f2'''
\set f3 '''00000000-0000-4000-a450-0000000000f3'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-45@example.com', 'Ana'), (:bea, 'bea-45@example.com', 'Bea'),
             (:carlos, 'carlos-45@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a450-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a450-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a450-00000000000c''); set local role authenticated;'

\set p1 '''00000000-0000-4000-a450-00000000000a/reforma/uno.webp'''
\set p2 '''00000000-0000-4000-a450-00000000000a/reforma/dos.webp'''
\set p3 '''00000000-0000-4000-a450-00000000000b/reforma/tres.webp'''

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:cocina, :ana, 'Cocina', 'coral', 'tasks', 2000);
insert into public.items (id, list_id, created_by, kind, title, status, position, url, image_url)
values (:reforma, :cocina, :ana, 'task', 'Reformar la cocina', 'pending', 1000,
        'https://www.pinterest.es/cocinas', 'https://i.pinimg.com/cocina.jpg'),
       (:grifo, :cocina, :ana, 'task', 'Arreglar el grifo', 'pending', 2000, null, null);
reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:cocina, :bea, 'editor', now(), 3000);

-- ─── La primera es la de la cosa ────────────────────────────────────────────────────────────

:as_ana
insert into public.item_images (id, item_id, path, position) values
  (:f1, :reforma, :p1, 1000), (:f2, :reforma, :p2, 2000);
select results_eq(
  format('select image_path, image_url from public.items where id = %L', :reforma),
  format('values (%L::text, null::text)', :p1),
  'con fotos, la primera es la de la cosa y la de la web deja de valer');

:as_bea
insert into public.item_images (id, item_id, path, position) values (:f3, :reforma, :p3, 3000);
select is((select count(*)::integer from public.item_images where item_id = :reforma), 3,
  'Bea, que está en la lista, añade la tercera');

:as_ana
update public.item_images set position = 500 where id = :f3;
select is((select image_path from public.items where id = :reforma), :p3,
  'ponerla la primera cambia la miniatura');
delete from public.item_images where id = :f3;
select is((select image_path from public.items where id = :reforma), :p1,
  'quitar la primera deja la siguiente');
delete from public.item_images where item_id = :reforma;
select is((select image_path from public.items where id = :reforma), null,
  'sin fotos, la cosa se queda sin foto');

-- ─── Como mucho 10 ──────────────────────────────────────────────────────────────────────────

insert into public.item_images (item_id, path, position)
select :grifo, 'x/' || n || '.webp', n * 1000 from generate_series(1, 10) n;
select throws_ok(format($$insert into public.item_images (item_id, path) values (%L, 'x/11.webp')$$,
                        :grifo),
  '23514', null, 'la undécima no entra');

-- ─── Quién las ve ───────────────────────────────────────────────────────────────────────────

insert into public.item_images (id, item_id, path, position) values
  (:f1, :reforma, :p1, 1000), (:f2, :reforma, :p2, 2000);

:as_carlos
select is_empty(format('select 1 from public.item_images where item_id = %L', :reforma),
  'Carlos no ve las fotos de una lista que no es suya');
select throws_ok(format($$insert into public.item_images (item_id, path) values (%L, 'c/x.webp')$$,
                        :reforma),
  '42501', null, 'ni las añade');
select ok(not public.can_see_photo(:p2), 'ni puede abrir el archivo de la segunda');

:as_bea
select ok(public.can_see_photo(:p2), 'Bea abre el archivo de la segunda, que no es la de la cosa');
select ok(public.can_see_photo(replace(:p2, '.webp', '-thumb.webp')), 'y su miniatura');

-- ─── Las huérfanas ──────────────────────────────────────────────────────────────────────────

reset role;
insert into storage.objects (bucket_id, name, owner, created_at) values
  ('item-images', :p1, :ana, now() - interval '1 hour'),
  ('item-images', :p2, :ana, now() - interval '1 hour'),
  ('item-images', replace(:p2, '.webp', '-thumb.webp'), :ana, now() - interval '1 hour'),
  ('item-images', '00000000-0000-4000-a450-00000000000a/reforma/vieja.webp', :ana,
   now() - interval '1 hour');

:as_ana
select results_eq('select public.orphan_photos()',
  $$values ('00000000-0000-4000-a450-00000000000a/reforma/vieja.webp')$$,
  'la segunda y su miniatura no son huérfanas: solo la que no usa nadie');

-- ─── Duplicar las lleva todas ───────────────────────────────────────────────────────────────

select public.duplicate_list(:cocina, 'Cocina (2)') as result \gset
select is(
  (select jsonb_agg(p -> 'path' order by (p ->> 'position')::integer)
   from jsonb_array_elements(:'result'::jsonb -> 'photos') p
   where (p ->> 'item_id')::uuid = (select id from public.items
                                    where list_id = (:'result'::jsonb ->> 'list_id')::uuid
                                      and title = 'Reformar la cocina')),
  jsonb_build_array(:p1, :p2),
  'duplicar devuelve las dos fotos de la reforma, en su orden');

-- ─── Borrar ─────────────────────────────────────────────────────────────────────────────────

delete from public.items where id = :reforma;
select is_empty(format('select 1 from public.item_images where item_id = %L', :reforma),
  'borrar la cosa se lleva sus fotos');

reset role;
select ok((select prosecdef from pg_proc where proname = 'item_links_sync'),
  '`item_links_sync` corre como su dueño');
-- Que borrar un usuario desde Studio ya no falla se prueba con la API de administración (lo hace
-- con el rol `supabase_auth_admin`, que estos tests no pueden tomar).

select * from finish(true);
rollback;
