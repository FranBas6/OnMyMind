-- Sesión 3.3 · Una lista compartida en el día a día: quién completa, quién está en cada lista y por
-- qué desaparece una lista (te quitan, se archiva, se borra). Ana comparte «Compras» con Bea;
-- Carlos no tiene nada que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a320-00000000000a'''
\set bea   '''00000000-0000-4000-a320-00000000000b'''
\set carlos '''00000000-0000-4000-a320-00000000000c'''
\set compras '''00000000-0000-4000-a320-0000000000c1'''
\set leche '''00000000-0000-4000-a320-0000000000e1'''

-- Tres cuentas (el alta crea su perfil, su «En mente» y sus listas de ejemplo).
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-32@example.com', 'Ana'), (:bea, 'bea-32@example.com', 'Bea'),
             (:carlos, 'carlos-32@example.com', 'Carlos')) as u(id, email, name);
update public.profiles set display_name = 'Ana' where id = :ana;
update public.profiles set display_name = 'Bea' where id = :bea;

-- Quién pregunta: `:as_ana`, `:as_bea`, `:as_carlos` (con su sesión) y `:as_admin` (sin RLS).
create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a320-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a320-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a320-00000000000c''); set local role authenticated;'
\set as_admin 'reset role;'

-- ─── Ana comparte «Compras» y Bea entra ──────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :ana, 'Compras compartidas', 'blue', 'shopping', 9000);
insert into public.items (id, list_id, kind, title, status, created_by)
values (:leche, :compras, 'shopping', 'Leche', 'pending', :ana);
select invite_token as token from public.create_list_invite(:compras) \gset
:as_bea
select public.accept_list_invite(:'token');

-- ─── Quién completa ──────────────────────────────────────────────────────────────────────────

:as_bea
update public.items set status = 'bought', completed_by = :ana where id = :leche;
:as_admin
select results_eq(format('select completed_by from public.items where id = %L', :leche),
  format('values (%L::uuid)', :bea),
  'Bea compra la leche: queda que la compró ella, aunque diga que fue Ana');
:as_ana
update public.items set status = 'pending' where id = :leche;
:as_admin
select results_eq(format('select completed_by from public.items where id = %L', :leche),
  $$values (null::uuid)$$, 'al volver a pendiente se olvida quién la compró');

-- ─── Quién está en cada lista compartida ─────────────────────────────────────────────────────

:as_bea
select results_eq(
  'select display_name, is_owner from public.shared_list_people() where list_id = '
    || quote_literal(:compras),
  $$values ('Ana', true), ('Bea', false)$$, 'Bea sabe quién está en «Compras», primero Ana');
:as_ana
select is_empty(
  'select 1 from public.shared_list_people() s join public.lists l on l.id = s.list_id
   where l.name <> ''Compras compartidas''',
  'las listas que nadie comparte no salen');
:as_carlos
select is_empty('select * from public.shared_list_people()', 'Carlos no ve a nadie');

-- ─── Te quitan ───────────────────────────────────────────────────────────────────────────────

:as_ana
delete from public.list_members where list_id = :compras and user_id = :bea;
:as_bea
select results_eq(
  format('select reason, list_name, owner_name from public.list_departures where list_id = %L', :compras),
  $$values ('removed', 'Compras compartidas', 'Ana')$$,
  'si Ana quita a Bea, Bea puede saber que la quitaron, de qué lista y quién');
:as_ana
select is_empty('select * from public.list_departures', 'Ana no ve las salidas de Bea');

-- Vuelve a entrar: lo de antes se olvida. Y si sale ella, no queda nada (ya sabe por qué).
:as_bea
select public.accept_list_invite(:'token');
select is_empty('select * from public.list_departures', 'al volver a entrar, se olvida');
delete from public.list_members where list_id = :compras and user_id = :bea;
select is_empty('select * from public.list_departures', 'salir por tu cuenta no deja nada');
select public.accept_list_invite(:'token');

-- ─── Archivar y desarchivar ──────────────────────────────────────────────────────────────────

:as_ana
update public.lists set archived_at = now() where id = :compras;
:as_bea
select results_eq(format('select reason from public.list_departures where list_id = %L', :compras),
  $$values ('archived')$$, 'Ana archiva: para Bea, archivada');
:as_ana
update public.lists set archived_at = null where id = :compras;
:as_bea
select is_empty('select * from public.list_departures', 'Ana desarchiva: vuelve, y se olvida');

-- ─── Borrar ──────────────────────────────────────────────────────────────────────────────────

:as_ana
delete from public.lists where id = :compras;
:as_bea
select results_eq(
  format('select reason, list_name, owner_name from public.list_departures where list_id = %L', :compras),
  $$values ('deleted', 'Compras compartidas', 'Ana')$$,
  'Ana borra la lista: Bea sabe que la borró, aunque la lista ya no exista');

-- Al borrar la cuenta de Ana, su otra lista compartida también lo dice.
:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values ('00000000-0000-4000-a320-0000000000c2', :ana, 'Casa de Ana', 'teal', 'tasks', 9100);
select invite_token as token2 from public.create_list_invite('00000000-0000-4000-a320-0000000000c2') \gset
:as_bea
select public.accept_list_invite(:'token2');
:as_admin
delete from auth.users where id = :ana;
:as_bea
select results_eq(
  $$select reason, list_name from public.list_departures
    where list_id = '00000000-0000-4000-a320-0000000000c2'$$,
  $$values ('deleted', 'Casa de Ana')$$, 'si Ana borra su cuenta, Bea sabe que su lista se borró');

select * from finish(true);
rollback;
