-- Sesión 3.4 · En directo: cada cambio de una lista se avisa al canal privado de quienes la ven
-- (`user:<id>`), y nadie puede escuchar el de otro. Ana comparte «Compras» con Bea; Carlos no
-- tiene nada que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a340-00000000000a'''
\set bea   '''00000000-0000-4000-a340-00000000000b'''
\set carlos '''00000000-0000-4000-a340-00000000000c'''
\set compras '''00000000-0000-4000-a340-0000000000c1'''
\set casa '''00000000-0000-4000-a340-0000000000c2'''
\set leche '''00000000-0000-4000-a340-0000000000e1'''
\set pan '''00000000-0000-4000-a340-0000000000e2'''
\set huevos '''00000000-0000-4000-a340-0000000000e3'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-34@example.com', 'Ana'), (:bea, 'bea-34@example.com', 'Bea'),
             (:carlos, 'carlos-34@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a340-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a340-00000000000b''); set local role authenticated;'
\set as_admin 'reset role;'

-- Lo que ha recibido cada uno desde el último `pg_temp.clear()`.
create function pg_temp.inbox(uid uuid) returns setof jsonb language sql as $$
  select payload - 'id' from realtime.messages
  where topic = 'user:' || uid and extension = 'broadcast' and event = 'change'
  order by inserted_at, payload ->> 'kind'
$$;
create function pg_temp.clear() returns void language sql as $$
  delete from realtime.messages where topic like 'user:00000000-0000-4000-a340-%'
$$;

-- ─── Ana comparte «Compras» y Bea entra ──────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :ana, 'Compras en directo', 'blue', 'shopping', 9000),
       (:casa, :ana, 'Casa de Ana', 'coral', 'tasks', 9100);
select invite_token as token from public.create_list_invite(:compras) \gset
:as_admin
select pg_temp.clear();
:as_bea
select public.accept_list_invite(:'token');
:as_admin
select results_eq(format('select p ->> ''kind'' from pg_temp.inbox(%L) p', :ana),
  $$values ('people')$$, 'Bea entra: Ana se entera (cambian las iniciales)');
select pg_temp.clear();

-- ─── Ítems ───────────────────────────────────────────────────────────────────────────────────

:as_ana
insert into public.items (id, list_id, kind, title, status, created_by, position)
values (:leche, :compras, 'shopping', 'Leche', 'pending', :ana, 1000),
       (:pan, :compras, 'shopping', 'Pan', 'pending', :ana, 2000),
       (:huevos, :compras, 'shopping', 'Huevos', 'pending', :ana, 3000);
:as_admin
select results_eq(format('select p from pg_temp.inbox(%L) p', :bea),
  format($$values (jsonb_build_object('kind', 'items', 'list_id', %L::uuid, 'by', %L::uuid,
                    'session', null, 'added', jsonb_build_array(%L::uuid, %L::uuid, %L::uuid),
                    'completed', '[]'::jsonb))$$,
         :compras, :ana, :leche, :pan, :huevos),
  'Ana añade tres cosas de una vez: a Bea le llega un mensaje con las tres y quién fue');
select results_eq(format('select count(*)::int from pg_temp.inbox(%L)', :ana), $$values (1)$$,
  'a Ana también (su otro dispositivo)');
select is_empty(format('select * from pg_temp.inbox(%L)', :carlos), 'a Carlos, nada');
select pg_temp.clear();

:as_ana
update public.items set position = position + 10 where list_id = :compras;
:as_admin
select results_eq(format('select count(*)::int from pg_temp.inbox(%L)', :bea), $$values (1)$$,
  'reordenar tres cosas es un solo mensaje');
select pg_temp.clear();

:as_bea
update public.items set status = 'bought' where id = :leche;
:as_admin
select results_eq(
  format('select p -> ''completed'', p ->> ''by'' from pg_temp.inbox(%L) p', :ana),
  format($$values (jsonb_build_array(%L::uuid), %L)$$, :leche, :bea),
  'Bea compra la leche: Ana sabe que la terminó ella');
select pg_temp.clear();

:as_bea
update public.items set title = 'Pan de pueblo' where id = :pan;
:as_admin
select results_eq(format('select p -> ''completed'' from pg_temp.inbox(%L) p', :ana),
  $$values ('[]'::jsonb)$$, 'cambiar el título avisa, sin nada terminado');
select pg_temp.clear();

:as_ana
update public.items set list_id = :casa, kind = 'task' where id = :huevos;
:as_admin
select results_eq(format('select p ->> ''list_id'' from pg_temp.inbox(%L) p', :bea),
  format('values (%L)', :compras), 'Ana se lleva los huevos a su lista: Bea ve que salen de Compras');
select results_eq(
  format('select p ->> ''list_id'' from pg_temp.inbox(%L) p order by 1', :ana),
  format('values (%L), (%L)', :compras, :casa), 'y Ana recibe las dos listas');
select pg_temp.clear();

:as_bea
delete from public.items where id = :pan;
:as_admin
select results_eq(format('select p ->> ''kind'', p ->> ''list_id'' from pg_temp.inbox(%L) p', :ana),
  format($$values ('items', %L)$$, :compras), 'Bea borra el pan: Ana se entera');
select is_empty(format('select * from pg_temp.inbox(%L)', :carlos),
  'y Carlos sigue sin saber nada (los borrados no se cuentan a todos)');
select pg_temp.clear();

-- Desde el iPhone de Bea (su sesión en ese dispositivo): el mensaje dice cuál, para que ese
-- dispositivo sepa que era suyo y los demás de Bea no.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :bea, 'role', 'authenticated',
                  'session_id', 'iphone-de-bea')::text, true);
set local role authenticated;
update public.items set title = 'Leche sin lactosa' where id = :leche;
:as_admin
select results_eq(format('select p ->> ''session'' from pg_temp.inbox(%L) p', :bea),
  $$values ('iphone-de-bea')$$, 'el mensaje dice desde qué sesión se hizo');
select pg_temp.clear();

-- ─── La lista y quién está ───────────────────────────────────────────────────────────────────

:as_ana
update public.lists set name = 'Compras de la semana' where id = :compras;
:as_admin
select results_eq(format('select p ->> ''kind'' from pg_temp.inbox(%L) p', :bea),
  $$values ('list')$$, 'Ana le cambia el nombre: Bea lo ve');
select pg_temp.clear();

:as_bea
select public.set_list_positions(jsonb_build_array(jsonb_build_object('id', :compras, 'position', 500)));
:as_admin
select is_empty(format('select * from pg_temp.inbox(%L)', :ana),
  'Bea ordena su Inicio: a Ana no le llega nada');
select results_eq(format('select p ->> ''kind'' from pg_temp.inbox(%L) p', :bea),
  $$values ('list')$$, 'a Bea sí (sus otros dispositivos)');
select pg_temp.clear();

:as_ana
update public.lists set archived_at = now() where id = :compras;
:as_admin
select results_eq(format('select p ->> ''kind'', p ->> ''reason'' from pg_temp.inbox(%L) p', :bea),
  $$values ('departure', 'archived'), ('list', null)$$,
  'Ana la archiva: Bea recibe el porqué al momento');
:as_ana
update public.lists set archived_at = null where id = :compras;
:as_admin
select pg_temp.clear();

:as_ana
delete from public.list_members where list_id = :compras and user_id = :bea;
:as_admin
select results_eq(format('select p ->> ''kind'', p ->> ''reason'' from pg_temp.inbox(%L) p', :bea),
  $$values ('departure', 'removed'), ('people', null)$$,
  'Ana quita a Bea: Bea lo sabe al momento, aunque ya no vea la lista');
select results_eq(format('select p ->> ''kind'' from pg_temp.inbox(%L) p', :ana),
  $$values ('people')$$, 'y a Ana le cambian las iniciales');
select pg_temp.clear();

-- ─── Cada uno, solo su canal ─────────────────────────────────────────────────────────────────

:as_ana
update public.lists set color = 'green' where id = :compras;
:as_bea
select set_config('realtime.topic', 'user:' || :ana, true);
select is_empty('select * from realtime.messages', 'Bea no puede escuchar el canal de Ana');
:as_ana
select set_config('realtime.topic', 'user:' || :ana, true);
select isnt_empty('select * from realtime.messages', 'Ana, el suyo sí');
:as_admin
select pg_temp.clear();
:as_bea
select realtime.send('{"kind": "list"}', 'change', 'user:' || :ana, true);
:as_admin
select is_empty(format('select * from pg_temp.inbox(%L)', :ana),
  'y desde la app no se manda nada a nadie (sin política de insert)');

select * from finish(true);
rollback;
