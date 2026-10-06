-- Sesión 3.2 · Compartir una lista: RLS y funciones con tres personas. Ana crea «Compras» y la
-- comparte; Bea entra con el enlace; Carlos no tiene nada que ver. Todo va en una transacción que
-- se deshace al final: no deja nada en la base. `pnpm db:test`.

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

-- ─── Ana crea «Compras» y la comparte ────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:compras, :ana, 'Compras compartidas', 'blue', 'shopping', 9000);
insert into public.items (id, list_id, kind, title, status, created_by)
values (:leche, :compras, 'shopping', 'Leche', 'pending', :ana);

select throws_ok(
  format('select * from public.create_list_invite(%L)',
         (select id from public.lists where owner_id = :ana and kind = 'inbox')),
  '42501', '«En mente» no se comparte.', '«En mente» no se comparte');

select invite_token as token from public.create_list_invite(:compras) \gset
select is((select invite_token from public.create_list_invite(:compras)), :'token',
  'pedir el enlace otra vez da el mismo, mientras siga activo');

-- ─── Antes de entrar, Bea no ve nada y no puede colarse ──────────────────────────────────────

:as_bea
select is_empty(format('select id from public.lists where id = %L', :compras),
  'Bea no ve la lista antes de entrar');
select throws_ok(
  format('insert into public.list_members (list_id, user_id, accepted_at) values (%L, %L, now())',
         :compras, :bea),
  '42501', null, 'nadie entra en list_members sin invitación');
select throws_ok(format('select * from public.create_list_invite(%L)', :compras),
  '42501', null, 'Bea no puede invitar a una lista que no es suya');
select is_empty(format('select id from public.list_invites where list_id = %L', :compras),
  'Bea no ve las invitaciones de Ana');

-- La vista previa, también sin sesión.
:as_admin
select set_config('request.jwt.claims', '', true);
set local role anon;
select results_eq(
  format('select status, list_name, list_kind::text, pending_count, inviter_name, member_since
          from public.list_invite_preview(%L)', :'token'),
  $$values ('valid', 'Compras compartidas', 'shopping', 1, 'Ana', null::timestamptz)$$,
  'sin sesión, el enlace dice quién invita, a qué lista y cuántas cosas tiene');
select is(length(:'token'), 12, 'el token es corto: 12 caracteres');
select results_eq($$select status, list_name from public.list_invite_preview('no-existe')$$,
  $$values ('unknown', null::text)$$, 'de un enlace que no existe no se dice nada');
select throws_ok(format('select * from public.accept_list_invite(%L)', :'token'),
  '42501', null, 'sin sesión no se entra');

-- ─── Bea entra ───────────────────────────────────────────────────────────────────────────────

:as_bea
select results_eq(format('select status from public.accept_list_invite(%L)', :'token'),
  $$values ('joined')$$, 'Bea entra con el enlace');
select results_eq(format('select status from public.accept_list_invite(%L)', :'token'),
  $$values ('member')$$, 'abrirlo otra vez dice que ya está dentro');
select results_eq(
  format('select status, member_since is not null from public.list_invite_preview(%L)', :'token'),
  $$values ('member', true)$$, 'y la vista previa dice desde cuándo');
select results_eq(
  format('select is_owner, position from public.my_lists where id = %L', :compras),
  $$values (false, (select max(position) + 0 from public.lists
                    where owner_id = '00000000-0000-4000-a320-00000000000b') + 1000)$$,
  'la lista sale en el Inicio de Bea, al final de las suyas y como no suya');
select results_eq(format('select title from public.items where list_id = %L', :compras),
  $$values ('Leche')$$, 'Bea ve los ítems');

-- Con los ítems, todo.
insert into public.items (list_id, kind, title, status, created_by)
values (:compras, 'shopping', 'Pan', 'pending', :bea);
update public.items set status = 'bought' where id = :leche;
select results_eq(
  format('select title, status from public.items where list_id = %L order by title', :compras),
  $$values ('Leche', 'bought'), ('Pan', 'pending')$$, 'Bea añade y completa');

-- Con la lista, nada.
update public.lists set name = 'Mía' where id = :compras;
delete from public.lists where id = :compras;
select public.set_list_positions(jsonb_build_array(jsonb_build_object('id', :compras, 'position', 5)));
:as_admin
select results_eq(format('select name, position from public.lists where id = %L', :compras),
  $$values ('Compras compartidas', 9000)$$,
  'Bea no renombra ni borra la lista, y su orden no mueve el de Ana');
select results_eq(
  format('select position from public.list_members where list_id = %L and user_id = %L',
         :compras, :bea),
  $$values (5)$$, 'el orden de Bea va en su fila');

-- Quién está.
:as_bea
select results_eq(
  format('select display_name, is_owner, joined_at is not null from public.list_people(%L)', :compras),
  $$values ('Ana', true, false), ('Bea', false, true)$$,
  'Bea ve quién está: primero quien la creó, y cuándo entró cada uno');

-- ─── Carlos ───────────────────────────────────────────────────────────────────────────────────

:as_carlos
select is_empty(format('select id from public.items where list_id = %L', :compras),
  'Carlos no ve los ítems');
select is_empty(format('select * from public.list_people(%L)', :compras),
  'Carlos no ve quién está');
select is_empty(format('select * from public.list_members where list_id = %L', :compras),
  'Carlos no ve los miembros');

-- ─── Enlaces anulados y caducados ─────────────────────────────────────────────────────────────

:as_ana
select is((select invite_token from public.create_list_invite(:compras)), :'token',
  'el enlace sigue activo después de que entre Bea: vale para quien lo abra');
select public.revoke_list_invite(:compras);
:as_carlos
select results_eq(format('select status from public.accept_list_invite(%L)', :'token'),
  $$values ('revoked')$$, 'un enlace anulado no deja entrar');
:as_bea
select results_eq(format('select count(*)::int from public.items where list_id = %L', :compras),
  $$values (2)$$, 'quien ya entró sigue dentro al anular el enlace');

:as_ana
select invite_token as token3 from public.create_list_invite(:compras) \gset
:as_admin
update public.list_invites set expires_at = now() - interval '1 minute' where token = :'token3';
:as_carlos
select results_eq(format('select status from public.accept_list_invite(%L)', :'token3'),
  $$values ('expired')$$, 'un enlace caducado no deja entrar');

-- ─── Fotos ────────────────────────────────────────────────────────────────────────────────────

:as_admin
insert into storage.objects (bucket_id, name, created_at)
values ('item-images', :ana || '/leche.webp', now() - interval '1 hour'),
       ('item-images', :ana || '/leche-thumb.webp', now() - interval '1 hour'),
       ('item-images', :bea || '/pan.webp', now() - interval '1 hour');
update public.items set image_path = :ana || '/leche.webp' where id = :leche;
update public.items set image_path = :bea || '/pan.webp' where list_id = :compras and title = 'Pan';

:as_bea
select results_eq(
  format('select count(*)::int from storage.objects where name in (%L, %L)',
         :ana || '/leche.webp', :ana || '/leche-thumb.webp'),
  $$values (2)$$, 'Bea ve la foto de Ana y su miniatura');
:as_carlos
select results_eq(
  format('select count(*)::int from storage.objects where name like %L', :ana || '/%'),
  $$values (0)$$, 'Carlos no ve las fotos de Ana');

-- ─── El aviso de Ana se mueve si Bea cambia la fecha ──────────────────────────────────────────

:as_ana
update public.items set kind = 'task', status = 'pending', due_at = now() + interval '2 days'
where list_id = :compras and title = 'Pan';
insert into public.reminders (item_id, user_id, remind_at, offset_minutes)
select id, :ana, now(), 60 from public.items where list_id = :compras and title = 'Pan';
:as_admin
select remind_at as before_at from public.reminders where user_id = :ana \gset
:as_bea
update public.items set due_at = now() + interval '5 days' where list_id = :compras and title = 'Pan';
:as_admin
select cmp_ok((select remind_at from public.reminders where user_id = :ana), '>',
  :'before_at'::timestamptz, 'Bea cambia la fecha y el aviso relativo de Ana se mueve');

-- ─── Salir ────────────────────────────────────────────────────────────────────────────────────

:as_carlos
delete from public.list_members where list_id = :compras and user_id = :bea;
:as_bea
select isnt_empty(format('select id from public.items where list_id = %L', :compras),
  'Carlos no puede echar a Bea');
delete from public.list_members where list_id = :compras and user_id = :bea;
select is_empty(format('select id from public.items where list_id = %L', :compras),
  'Bea sale de la lista y deja de verla');
select is_empty(format('select * from public.my_lists where id = %L', :compras),
  'y deja de salir en su Inicio');
select is_empty('select * from public.orphan_photos()',
  'la foto de Bea que sigue en la lista de Ana no se da por huérfana');
:as_admin
select results_eq(format('select count(*)::int from public.items where list_id = %L', :compras),
  $$values (2)$$, 'lo que añadió Bea se queda en la lista');

-- ─── Borrar la cuenta ─────────────────────────────────────────────────────────────────────────

-- Bea vuelve a entrar y borra su cuenta: lo suyo se queda, a nombre de Ana y sin su foto.
insert into public.list_members (list_id, user_id, accepted_at) values (:compras, :bea, now());
set local storage.allow_delete_query = 'true';
delete from storage.objects where name = :bea || '/pan.webp';
delete from auth.users where id = :bea;
select results_eq(
  format('select title, created_by, image_path from public.items where list_id = %L and title = %L',
         :compras, 'Pan'),
  format('values (%L, %L::uuid, null::text)', 'Pan', :ana),
  'al borrar la cuenta de Bea, lo que añadió se queda, a nombre de Ana y sin su foto');

-- Ana borra la suya: su lista compartida se va con ella.
delete from auth.users where id = :ana;
select is_empty(format('select id from public.lists where id = %L', :compras),
  'al borrar la cuenta de Ana, su lista se borra');

select * from finish(true);
rollback;
