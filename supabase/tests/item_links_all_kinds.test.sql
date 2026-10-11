-- Sesión 4.6 · Varios enlaces: una tarea con varios enlaces se queda con el primero y sin precio,
-- al quitar hasta uno vuelve a la tarea, y pasar una compra de dos tiendas a tarea y volver no
-- pierde nada. Ana tiene «Casa», compartida con Bea; Carlos no tiene nada que ver. En una
-- transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a460-00000000000a'''
\set bea    '''00000000-0000-4000-a460-00000000000b'''
\set carlos '''00000000-0000-4000-a460-00000000000c'''
\set casa   '''00000000-0000-4000-a460-0000000000a1'''
\set cocina '''00000000-0000-4000-a460-0000000000d1'''
\set monitor '''00000000-0000-4000-a460-0000000000d2'''
\set l1 '''00000000-0000-4000-a460-0000000000e1'''
\set l2 '''00000000-0000-4000-a460-0000000000e2'''
\set l3 '''00000000-0000-4000-a460-0000000000e3'''
\set pc '''00000000-0000-4000-a460-0000000000f1'''
\set mm '''00000000-0000-4000-a460-0000000000f2'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-46@example.com', 'Ana'), (:bea, 'bea-46@example.com', 'Bea'),
             (:carlos, 'carlos-46@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a460-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a460-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a460-00000000000c''); set local role authenticated;'

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:casa, :ana, 'Casa', 'coral', 'tasks', 2000);
insert into public.items (id, list_id, created_by, kind, title, status, position, url, url_title,
                          url_site)
values (:cocina, :casa, :ana, 'task', 'Reformar la cocina', 'pending', 1000,
        'https://www.pinterest.es/cocinas', 'Ideas de cocinas pequeñas', 'Pinterest');
insert into public.items (id, list_id, created_by, kind, title, status, position, url, price_cents,
                          price_source)
values (:monitor, :casa, :ana, 'shopping', 'Monitor', 'pending', 2000,
        'https://www.pccomponentes.com/monitor', 26900, 'web');
reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:casa, :bea, 'editor', now(), 3000);

-- ─── Una tarea con tres enlaces ─────────────────────────────────────────────────────────────

-- Como con las tiendas: al añadir el segundo, el de la tarea pasa a la lista con él.
:as_ana
insert into public.item_links (id, item_id, url, url_title, url_site, position) values
  (:l1, :cocina, 'https://www.pinterest.es/cocinas', 'Ideas de cocinas pequeñas', 'Pinterest', 1000),
  (:l2, :cocina, 'https://cocinasmartin.es/presupuesto', null, null, 2000);
:as_bea
insert into public.item_links (id, item_id, url, url_title, position, price_cents, price_source)
values (:l3, :cocina, 'https://www.leroymerlin.es/encimera', 'Encimera de cuarzo blanco', 3000,
        18900, 'web');
select is((select count(*)::integer from public.item_links where item_id = :cocina), 3,
  'Bea, que está en la lista, añade el tercero');

:as_ana
select results_eq(
  format('select url, url_title, price_cents, price_link_id, price_store from public.items where id = %L',
         :cocina),
  $$values ('https://www.pinterest.es/cocinas'::text, 'Ideas de cocinas pequeñas'::text,
            null::integer, null::uuid, null::text)$$,
  'la tarea se queda con el primero y sin precio, aunque un enlace lo traiga');

update public.item_links set position = 500 where id = :l2;
select is((select url from public.items where id = :cocina), 'https://cocinasmartin.es/presupuesto',
  'ponerlo el primero cambia el de la tarea');

:as_carlos
select is_empty(format('select 1 from public.item_links where item_id = %L', :cocina),
  'Carlos no ve los enlaces de una lista que no es suya');

-- ─── Quitar hasta uno ───────────────────────────────────────────────────────────────────────

:as_ana
delete from public.item_links where id = :l2;
select is((select url from public.items where id = :cocina), 'https://www.pinterest.es/cocinas',
  'quitar el primero deja el siguiente');
delete from public.item_links where id = :l3;
select is_empty(format('select 1 from public.item_links where item_id = %L', :cocina),
  'con uno, vuelve a la tarea y la lista se vacía');
select results_eq(
  format('select url, url_title, price_cents from public.items where id = %L', :cocina),
  $$values ('https://www.pinterest.es/cocinas'::text, 'Ideas de cocinas pequeñas'::text,
            null::integer)$$,
  'y la tarea es como antes');

-- ─── De compra a tarea y vuelta ─────────────────────────────────────────────────────────────

insert into public.item_links (id, item_id, url, url_site, price_cents, price_source, position)
values (:pc, :monitor, 'https://www.pccomponentes.com/monitor', 'PcComponentes', 26900, 'web', 1000),
       (:mm, :monitor, 'https://www.mediamarkt.es/monitor', 'MediaMarkt', 24900, 'web', 2000);
select results_eq(
  format('select price_cents, price_link_id, price_store from public.items where id = %L', :monitor),
  format('values (24900, %L::uuid, %L::text)', :mm, 'MediaMarkt'),
  'la compra cuenta la más barata');

-- Lo que hace la app al pasarla a tarea (`changeKindPatch`): quita el precio.
update public.items set kind = 'task', price_cents = null, price_source = null
where id = :monitor;
select is((select count(*)::integer from public.item_links where item_id = :monitor), 2,
  'como tarea conserva sus dos enlaces');
select is((select array_agg(price_cents order by position) from public.item_links
           where item_id = :monitor), array[26900, 24900],
  'con sus precios guardados');
select is((select price_cents from public.items where id = :monitor), null,
  'aunque la tarea no tiene precio');

update public.items set kind = 'shopping' where id = :monitor;
select results_eq(
  format('select price_cents, price_source::text, price_link_id, price_store, url from public.items where id = %L',
         :monitor),
  format('values (24900, %L::text, %L::uuid, %L::text, %L::text)', 'web', :mm, 'MediaMarkt',
         'https://www.pccomponentes.com/monitor'),
  'al volver a compra recupera el precio de la más barata, aunque el cambio no lo traiga');
select is((select price_checked_at is not null from public.items where id = :monitor), true,
  'con su fecha');

-- Una compra con una sola tienda se queda como estaba: el precio va en la cosa.
update public.items set kind = 'task', price_cents = null, price_source = null
where id = :monitor;
delete from public.item_links where id = :mm;
update public.items set kind = 'shopping' where id = :monitor;
select is((select price_cents from public.items where id = :monitor), null,
  'con un enlace no hay precio que recuperar: se busca en la web, como siempre');

-- ─── Duplicar lleva los enlaces de una tarea ────────────────────────────────────────────────

insert into public.item_links (item_id, url, position) values
  (:cocina, 'https://www.pinterest.es/cocinas', 1000),
  (:cocina, 'https://cocinasmartin.es/presupuesto', 2000);
select public.duplicate_list(:casa, 'Casa (2)') as result \gset
select is(
  (select count(*)::integer from public.item_links k join public.items i on i.id = k.item_id
   where i.list_id = (:'result'::jsonb ->> 'list_id')::uuid and i.title = 'Reformar la cocina'),
  2, 'duplicar copia los dos enlaces de la tarea');

select * from finish(true);
rollback;
