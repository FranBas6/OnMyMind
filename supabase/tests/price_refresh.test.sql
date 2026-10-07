-- Sesión 3.8 · Precios que se miran solos: qué compras se miran, qué se guarda al mirarlas, cuándo
-- se deja de mirar y a quién se avisa de una bajada. Ana comparte «Compras» con Bea; Carlos no tiene
-- nada que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a380-00000000000a'''
\set bea   '''00000000-0000-4000-a380-00000000000b'''
\set carlos '''00000000-0000-4000-a380-00000000000c'''
\set compras '''00000000-0000-4000-a380-0000000000c1'''
\set viejas '''00000000-0000-4000-a380-0000000000c2'''
\set cascos '''00000000-0000-4000-a380-0000000000e1'''
\set bombillas '''00000000-0000-4000-a380-0000000000e2'''
\set teclado '''00000000-0000-4000-a380-0000000000e3'''
\set monitor '''00000000-0000-4000-a380-0000000000e4'''
\set comprado '''00000000-0000-4000-a380-0000000000e5'''
\set archivado '''00000000-0000-4000-a380-0000000000e6'''
\set pccom '''00000000-0000-4000-a380-0000000000f1'''
\set amazon '''00000000-0000-4000-a380-0000000000f2'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-38@example.com', 'Ana'), (:bea, 'bea-38@example.com', 'Bea'),
             (:carlos, 'carlos-38@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a380-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a380-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a380-00000000000c''); set local role authenticated;'
\set as_fn 'reset role; set local role service_role;'

-- Lo que hay en la base de antes no cuenta: solo se miran las compras de esta prueba. Se mira como
-- admin (la función es `security definer`); los permisos se prueban aparte.
create temp table due on commit drop as select * from public.price_checks_due(1000);
create function pg_temp.due_here() returns setof text language sql as $$
  select d.target || ':' || coalesce(i.title, k.url)
  from public.price_checks_due(1000) d
  left join public.items i on d.target = 'item' and i.id = d.id
  left join public.item_links k on d.target = 'link' and k.id = d.id
  where not exists (select 1 from due o where o.id = d.id)
  order by 1
$$;

-- ─── Ana y sus compras ───────────────────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :ana, 'Compras 38', 'blue', 'shopping', 9000),
       (:viejas, :ana, 'Viejas 38', 'teal', 'shopping', 9001);
select invite_token as token from public.create_list_invite(:compras) \gset
:as_bea
select public.accept_list_invite(:'token') as _ \gset

:as_ana
insert into public.items (id, list_id, kind, title, status, created_by, url, price_cents,
                          price_source)
values
  (:cascos, :compras, 'shopping', 'Auriculares', 'pending', :ana, 'https://keychron.com/k1', 9900,
   'web'),
  (:bombillas, :compras, 'shopping', 'Bombillas', 'pending', :ana, 'https://amazon.es/b', 1200,
   'manual'),
  (:teclado, :compras, 'shopping', 'Teclado', 'pending', :ana, 'https://ikea.com/t', 5000, 'web'),
  (:monitor, :compras, 'shopping', 'Monitor', 'pending', :ana, null, null, null),
  (:comprado, :compras, 'shopping', 'Ratón', 'pending', :ana, 'https://ikea.com/r', 2000, 'web'),
  (:archivado, :viejas, 'shopping', 'Lámpara', 'pending', :ana, 'https://ikea.com/l', 3000, 'web');
-- Dos tiendas en el monitor: PcComponentes dio precio; Amazon no, y se puso a mano.
insert into public.item_links (id, item_id, url, url_site, price_cents, price_source, position)
values (:pccom, :monitor, 'https://pccomponentes.com/m', 'PcComponentes', 30000, 'web', 1),
       (:amazon, :monitor, 'https://amazon.es/m', 'Amazon', 29000, 'manual', 2);
-- El teclado se cambió a mano después: se sigue mirando (Fran).
update public.items set price_cents = 4500, price_source = 'manual' where id = :teclado;
update public.items set status = 'bought' where id = :comprado;
update public.lists set archived_at = now() where id = :viejas;

select results_eq(
  format($$select title, price_followed from public.items
           where list_id in (%L, %L) and kind = 'shopping' order by title$$, :compras, :viejas),
  $$values ('Auriculares', true), ('Bombillas', false), ('Lámpara', true), ('Monitor', false),
           ('Ratón', true), ('Teclado', true)$$,
  'en seguimiento lo que la tienda dio alguna vez, también si luego se escribió a mano');
select results_eq(
  format('select url_site, price_followed from public.item_links where item_id = %L order by position',
         :monitor),
  $$values ('PcComponentes', true), ('Amazon', false)$$,
  'con varias tiendas, cada una la suya');

-- Un precio recién puesto cuenta como mirado hoy: como si fuera de anteayer.
reset role;
update public.items set price_checked_at = now() - interval '2 days'
where list_id in (:compras, :viejas) and price_checked_at is not null;
update public.item_links set price_checked_at = now() - interval '2 days' where item_id = :monitor;
select results_eq('select * from pg_temp.due_here()',
  $$values ('item:Auriculares'), ('item:Teclado'), ('link:https://pccomponentes.com/m')$$,
  'se miran las pendientes en seguimiento: ni compradas, ni archivadas, ni lo que nunca dio precio');

-- ─── «Avisarme si baja» ──────────────────────────────────────────────────────────────────────

:as_ana
insert into public.price_alerts (item_id, user_id) values (:cascos, :ana), (:monitor, :ana);
update public.profiles set settings = settings || '{"price_drop_alerts": true}' where id = :ana;
:as_bea
insert into public.price_alerts (item_id, user_id) values (:cascos, :bea);
select results_eq('select item_id from public.price_alerts', format('values (%L::uuid)', :cascos),
  'Bea ve solo los suyos');
select throws_ok(
  format('insert into public.price_alerts (item_id, user_id) values (%L, %L)', :cascos, :ana),
  '42501', null, 'y no puede pedirlo por Ana');
:as_carlos
select throws_ok(
  format('insert into public.price_alerts (item_id, user_id) values (%L, %L)', :cascos, :carlos),
  '42501', null, 'Carlos no puede pedirlo en una compra que no ve');
select throws_ok(format('select * from public.record_price_check(''item'', %L, 100)', :cascos),
  '42501', null, 'ni nadie desde la app puede apuntar un precio');

-- ─── Mirarlas ────────────────────────────────────────────────────────────────────────────────

:as_fn
select results_eq(
  format($$select title, store, before_cents, after_cents, currency, recipients
           from public.record_price_check('item', %L, 7900)$$, :cascos),
  format($$values ('Auriculares', 'keychron.com', 9900, 7900, 'EUR', array[%L::uuid])$$, :ana),
  'baja: avisa a Ana (lo pidió y tiene el general), no a Bea (sin el general)');
select results_eq(
  format($$select price_cents, previous_price_cents, price_source::text, price_checked_at > now() - interval '1 minute'
           from public.items where id = %L$$, :cascos),
  $$values (7900, 9900, 'auto', true)$$, 'el precio queda como automático');
select results_eq(
  format('select price_cents, source::text from public.item_prices where item_id = %L order by id', :cascos),
  $$values (9900, 'web'), (7900, 'auto')$$, 'y el histórico lo apunta como automático');
reset role;
select ok(not exists (select 1 from pg_temp.due_here() d where d = 'item:Auriculares'),
  'mirada hoy, no se vuelve a mirar hasta mañana');
:as_fn

select is_empty(format($$select * from public.record_price_check('item', %L, 4800)$$, :teclado),
  'el teclado sube de 45 a 48: se guarda sin avisar');
select results_eq(format('select price_cents, price_source::text from public.items where id = %L', :teclado),
  $$values (4800, 'auto')$$, 'y la web sustituye lo escrito a mano');

select results_eq(
  format($$select title, store, before_cents, after_cents, recipients
           from public.record_price_check('link', %L, 27500)$$, :pccom),
  format($$values ('Monitor', 'PcComponentes', 29000, 27500, array[%L::uuid])$$, :ana),
  'con varias tiendas, avisa si PcComponentes pasa a ser más barata que la más barata');
select results_eq(
  format('select price_cents, price_store from public.items where id = %L', :monitor),
  $$values (27500, 'PcComponentes')$$, 'y la compra pasa a su precio');
select is_empty(format($$select * from public.record_price_check('link', %L, 29500)$$, :pccom),
  'si PcComponentes sube, la más barata vuelve a ser Amazon y no avisa');

-- Bea enciende el general: desde entonces, a ella también.
reset role;
update public.profiles set settings = settings || '{"price_drop_alerts": true}' where id = :bea;
:as_fn
select results_eq(
  format('select recipients from public.record_price_check(''item'', %L, 6900)', :cascos),
  format('values (array[%L::uuid, %L::uuid])', :ana, :bea),
  'en una lista compartida, a los dos si cada uno lo tiene');

-- Bea sale de la lista: aunque quedara su fila, ya no le llega.
reset role;
delete from public.list_members where list_id = :compras and user_id = :bea;
:as_fn
select results_eq(
  format('select recipients from public.record_price_check(''item'', %L, 5900)', :cascos),
  format('values (array[%L::uuid])', :ana), 'quien ya no está en la lista no recibe nada');

-- ─── «Bajaron esta mañana» ───────────────────────────────────────────────────────────────────

:as_ana
select results_eq(
  'select title, price_cents, previous_price_cents from public.my_price_drops()',
  $$values ('Auriculares', 5900, 6900)$$,
  'la hoja de Ana: lo que bajó solo hoy y pidió (el monitor volvió a subir)');
:as_carlos
select is_empty('select * from public.my_price_drops()', 'Carlos no tiene nada');
:as_fn

-- ─── Cuando la tienda no lo da ───────────────────────────────────────────────────────────────

select is_empty(format($$select * from public.record_price_check('item', %L, null)$$, :teclado),
  'un fallo no devuelve nada');
reset role;
select results_eq(format('select price_failures, price_cents from public.items where id = %L', :teclado),
  $$values (1::smallint, 4800)$$, 'cuenta el fallo y deja el precio que había');
update public.items set price_failed_at = now() - interval '1 day',
                        price_checked_at = now() - interval '2 days' where id = :teclado;
select ok(exists (select 1 from pg_temp.due_here() d where d = 'item:Teclado'),
  'al día siguiente se vuelve a mirar');
:as_fn
select * from public.record_price_check('item', :teclado, null);
select * from public.record_price_check('item', :teclado, null);
reset role;
update public.items set price_failed_at = now() - interval '1 day' where id = :teclado;
select ok(not exists (select 1 from pg_temp.due_here() d where d = 'item:Teclado'),
  'tras tres fallos se deja de mirar');

-- «Actualizar precio» a mano, si da precio, la vuelve a poner en seguimiento.
:as_ana
update public.items set price_cents = 4700, price_source = 'web', price_checked_at = now()
where id = :teclado;
select results_eq(format('select price_failures, price_followed from public.items where id = %L', :teclado),
  $$values (0::smallint, true)$$, '«Actualizar precio» con éxito pone los fallos a cero');

-- Cambiar el enlace empieza de cero: la tienda nueva no ha dado precio todavía.
update public.items set url = 'https://otra-tienda.es/t' where id = :teclado;
select results_eq(format('select price_followed from public.items where id = %L', :teclado),
  $$values (false)$$, 'un enlace nuevo no está en seguimiento hasta que dé precio');

select * from finish(true);
rollback;
