-- Sesión 5.1 · Elegir una: «Volantes» en Compras, con el G29 (199 €) y el G923 (249,99 €), cuenta
-- una sola cosa pendiente y suma la más barata o, elegida una, la elegida. Elegir no compra ni
-- cierra nada. Duplicar conserva «para elegir una» sin la elegida. Ana tiene «Compras», compartida
-- con Bea; Carlos no tiene nada que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a510-00000000000a'''
\set bea    '''00000000-0000-4000-a510-00000000000b'''
\set carlos '''00000000-0000-4000-a510-00000000000c'''
\set compras '''00000000-0000-4000-a510-0000000000a1'''
\set volantes '''00000000-0000-4000-a510-0000000000b1'''
\set g29  '''00000000-0000-4000-a510-0000000000c1'''
\set g923 '''00000000-0000-4000-a510-0000000000c2'''
\set moza '''00000000-0000-4000-a510-0000000000c3'''
\set leche '''00000000-0000-4000-a510-0000000000c4'''
\set hotel '''00000000-0000-4000-a510-0000000000b2'''
\set plaza '''00000000-0000-4000-a510-0000000000d1'''
\set bairro '''00000000-0000-4000-a510-0000000000d2'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-51@example.com', 'Ana'), (:bea, 'bea-51@example.com', 'Bea'),
             (:carlos, 'carlos-51@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a510-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a510-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a510-00000000000c''); set local role authenticated;'

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :ana, 'Compras', 'blue', 'shopping', 2000);
insert into public.items (id, list_id, created_by, kind, parent_id, title, status, position,
                          price_cents)
values (:volantes, :compras, :ana, 'sublist', null, 'Volantes', 'pending', 1000, null),
       (:leche, :compras, :ana, 'shopping', null, 'Leche de avena', 'pending', 2000, 249),
       (:hotel, :compras, :ana, 'sublist', null, 'Hotel en Lisboa', 'pending', 3000, null),
       (:g29, :compras, :ana, 'shopping', :volantes, 'Logitech G29', 'pending', 1000, 19900),
       (:g923, :compras, :ana, 'shopping', :volantes, 'Logitech G923', 'pending', 2000, 24999),
       (:plaza, :compras, :ana, 'task', :hotel, 'Hotel Lisboa Plaza', 'pending', 1000, null),
       (:bairro, :compras, :ana, 'task', :hotel, 'Casa do Bairro', 'pending', 2000, null);
reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:compras, :bea, 'editor', now(), 3000);

create function pg_temp.counters(list uuid) returns table (p integer, d integer, cents integer)
language sql as $$
  select pending_count, done_count, pending_price_cents from public.list_counters
  where list_id = list
$$;

-- ─── Sumando, como siempre ───────────────────────────────────────────────────────────────────

:as_ana
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (5, 0, 45148)$$,
  'sin «elegir una», las dos opciones suman: 448,99 € y la leche, cinco pendientes');

-- ─── «Elegir una» ────────────────────────────────────────────────────────────────────────────

select throws_ok(format('update public.items set choose_one = true where id = %L', :g29),
  '23514', null, 'solo una sublista es «para elegir una»');

update public.items set choose_one = true where id in (:volantes, :hotel);
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (3, 0, 20149)$$,
  'con «elegir una», Volantes cuenta 199 € y una sola cosa pendiente, igual que los hoteles');

insert into public.items (id, list_id, created_by, kind, parent_id, title, status, position)
values (:moza, :compras, :ana, 'shopping', :volantes, 'Moza R3 (de segunda mano)', 'pending', 3000);
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (3, 0, 20149)$$,
  'una opción sin precio ni cuenta ni compite');

update public.items set price_cents = 18000, currency = 'USD' where id = :moza;
select results_eq(format('select cents from pg_temp.counters(%L)', :compras),
  $$values (20149)$$,
  'una en otra moneda tampoco: el total es en euros');
update public.items set price_cents = null, currency = 'EUR' where id = :moza;

update public.items set status = 'paused' where id = :volantes;
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (2, 0, 249)$$,
  'pausada, se calla como cualquier sublista');
update public.items set status = 'pending' where id = :volantes;

-- ─── Elegir: la preferida, sin cambiar estados ──────────────────────────────────────────────

:as_bea
update public.items set chosen_id = :g923 where id = :volantes;
:as_ana
select is((select chosen_id from public.items where id = :volantes), :g923::uuid,
  'Bea, que está en la lista, elige el G923');
select results_eq(
  format('select status from public.items where id in (%L, %L, %L) order by position, title',
         :volantes, :g29, :g923),
  $$values ('pending'::text), ('pending'), ('pending')$$,
  'elegir no compra, no descarta y no cierra la sublista');
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (3, 0, 25248)$$,
  'elegido el G923, cuenta lo suyo: 249,99 € y la leche');

:as_carlos
update public.items set chosen_id = :g29 where id = :volantes;
:as_ana
select is((select chosen_id from public.items where id = :volantes), :g923::uuid,
  'Carlos, que no ve la lista, no puede elegir');

update public.items set price_cents = null where id = :g923;
select results_eq(format('select cents from pg_temp.counters(%L)', :compras),
  $$values (249)$$,
  'si la elegida no tiene precio, no suma nada');
update public.items set price_cents = 24999 where id = :g923;

-- Comprarla va como siempre: ya no está pendiente, y cuenta la más barata de lo que queda.
update public.items set status = 'bought' where id = :g923;
select results_eq(
  format('select status, chosen_id from public.items where id in (%L, %L) order by position, title',
         :volantes, :g29),
  format($$values ('pending'::text, null::uuid), ('pending', %L::uuid)$$, :g923),
  'comprar la elegida no toca nada más: ni la otra ni la sublista');
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (3, 1, 20149)$$,
  'comprada la elegida, cuenta la más barata de lo que queda pendiente');
update public.items set status = 'pending' where id = :g923;

update public.items set status = 'done' where id = :volantes;
select results_eq(format('select * from pg_temp.counters(%L)', :compras),
  $$values (2, 0, 249)$$,
  'cerrada a mano, Volantes ya no cuenta y sigue sabiendo cuál se eligió');
select is((select chosen_id from public.items where id = :volantes), :g923::uuid,
  'hecha, conserva la elegida');
update public.items set status = 'pending' where id = :volantes;

-- ─── La elección se olvida ───────────────────────────────────────────────────────────────────

update public.items set choose_one = false where id = :volantes;
select is((select chosen_id from public.items where id = :volantes), null,
  'dejar de «elegir una» la olvida');

update public.items set choose_one = true, chosen_id = :g923 where id = :volantes;
update public.items set parent_id = null where id = :g923;
select is((select chosen_id from public.items where id = :volantes), null,
  'si la elegida sale de la sublista, se olvida');
update public.items set parent_id = :volantes where id = :g923;

update public.items set chosen_id = :g29 where id = :volantes;
delete from public.items where id = :g29;
select is((select chosen_id from public.items where id = :volantes), null,
  'si la elegida se borra, se olvida');

set constraints items_chosen_check immediate;
select throws_ok(format('update public.items set chosen_id = %L where id = %L', :leche, :volantes),
  '23514', null, 'la elegida tiene que ser de dentro');
set constraints items_chosen_check deferred;

-- ─── Hoteles: lo que no es compra ────────────────────────────────────────────────────────────

update public.items set chosen_id = :plaza where id = :hotel;
select results_eq(
  format('select status from public.items where id in (%L, %L, %L) order by position, title',
         :hotel, :plaza, :bairro),
  $$values ('pending'::text), ('pending'), ('pending')$$,
  'dos hoteles: elegido uno, todo sigue pendiente');
select results_eq(format('select p from pg_temp.counters(%L)', :compras),
  $$values (3)$$,
  'y los hoteles siguen contando como una cosa');

-- ─── Duplicar ────────────────────────────────────────────────────────────────────────────────

select public.duplicate_list(:compras, 'Compras (copia)');
select results_eq(
  $$select title, choose_one, chosen_id, status from public.items i
    join public.lists l on l.id = i.list_id
    where l.name = 'Compras (copia)' and i.kind = 'sublist' order by i.position$$,
  $$values ('Volantes'::text, true, null::uuid, 'pending'::text),
           ('Hotel en Lisboa', true, null, 'pending')$$,
  'la copia conserva «para elegir una», sin la elegida y pendiente');

select * from finish(true);
rollback;
