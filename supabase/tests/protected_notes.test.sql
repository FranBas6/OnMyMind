-- Sesión 5.7 · Notas protegidas (ADR-013): una protegida es una nota con su texto cifrado y sin
-- texto en claro, fotos ni enlaces; no está en una lista compartida, y una lista con protegidas no
-- se comparte; lo que se cifra de nuevo es con la clave de la caja de ahora; restaurar y duplicar
-- llevan lo cifrado tal cual. Ana tiene «Casa» y su caja; Bea comparte «Compras» con Ana. En una
-- transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana     '''00000000-0000-4000-a570-00000000000a'''
\set bea     '''00000000-0000-4000-a570-00000000000b'''
\set casa    '''00000000-0000-4000-a570-0000000000a1'''
\set compras '''00000000-0000-4000-a570-0000000000b1'''
\set wifi    '''00000000-0000-4000-a570-0000000000c1'''
\set alarma  '''00000000-0000-4000-a570-0000000000c2'''
\set super   '''00000000-0000-4000-a570-0000000000c3'''
\set tarea   '''00000000-0000-4000-a570-0000000000c4'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-57@example.com', 'Ana'),
             (:bea, 'bea-57@example.com', 'Bea')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a570-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a570-00000000000b''); set local role authenticated;'

-- Valores con la forma de los de verdad (base64).
\set salt   '''c2FsLWRlLTE2LWJ5dGVzIQ=='''
\set iv     '''aXYtZGUtMTItYnl0'''
\set wrap   '''Y2xhdmUtZGUtbGEtY2FqYS1jaWZyYWRhLWNvbi1sYS1jbGF2ZS1wcml2YWRhISE='''
\set check  '''Y29tcHJvYmFkb3ItZGUtMzItYnl0ZXMtc2hhMjU2ISE='''
\set sealed '''dGV4dG8tY2lmcmFkby1kZS1sYS1ub3RhLWRlbC13aWZpLWNvbi1sYS1ldGlxdWV0YQ=='''
\set other  '''b3Ryby10ZXh0by1jaWZyYWRvLWRlLWxhLW5vdGEtZGVsLXdpZmktY29uLXN1LWV0aXF1ZXRh'''

:as_ana
insert into public.private_vaults (kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
values (600000, :salt, :iv, :wrap, :check);
insert into public.lists (id, owner_id, name, color, kind, position) values
  (:casa, :ana, 'Casa', 'coral', 'list', 1000),
  (:compras, :ana, 'Compras', 'teal', 'list', 2000);
insert into public.items (id, list_id, created_by, kind, title, notes, status, position) values
  (:wifi, :casa, :ana, 'note', 'Wifi de casa', 'Clave: tq8M-29xk-Lp4r', 'pending', 1000),
  (:alarma, :casa, :ana, 'note', 'Código de la alarma', 'Código: 4512', 'pending', 2000),
  (:tarea, :casa, :ana, 'task', 'Arreglar el grifo', null, 'pending', 3000),
  (:super, :compras, :ana, 'note', 'Código del súper', 'Tarjeta 004512', 'pending', 1000);
reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:compras, :bea, 'editor', now(), 1000);

-- La clave de la caja de Ana, para cifrar con ella.
select key_id as ana_key from public.private_vaults where user_id = :ana \gset

-- ─── Proteger ────────────────────────────────────────────────────────────────────────────────

:as_ana
update public.items
set protected = true, notes = null, sealed_notes = :sealed, sealed_iv = :iv,
    sealed_key_id = :'ana_key'
where id = :wifi;
select results_eq(
  format('select protected, notes, sealed_notes from public.items where id = %L', :wifi),
  format('values (true, null::text, %L::text)', :sealed),
  'Ana protege «Wifi de casa»: en la base, solo lo cifrado');

select throws_ok(
  format($$update public.items set protected = true, sealed_notes = %L, sealed_iv = %L,
           sealed_key_id = %L where id = %L$$, :sealed, :iv, :'ana_key', :alarma),
  '23514', null, 'protegida sin texto en claro: con notas no se guarda');

select throws_ok(
  format($$update public.items set protected = true, sealed_notes = null where id = %L$$, :alarma),
  '23514', null, 'protegida sin lo cifrado no se guarda');

select throws_ok(
  format($$update public.items set protected = true, notes = null, sealed_notes = %L,
           sealed_iv = %L, sealed_key_id = %L where id = %L$$, :sealed, :iv, :'ana_key', :tarea),
  '23514', null, 'solo se protegen notas');

select throws_ok(
  format($$update public.items set kind = 'task' where id = %L$$, :wifi),
  '23514', null, 'una protegida no cambia de tipo');

select throws_ok(
  format($$update public.items set sealed_notes = %L where id = %L$$, :sealed, :tarea),
  '23514', null, 'sin proteger, nada cifrado');

select throws_ok(
  format($$update public.items set url = 'https://example.com' where id = %L$$, :wifi),
  '23514', null, 'una protegida no tiene enlace');

select throws_ok(
  format($$insert into public.item_images (item_id, path, position) values (%L, %L, 1000)$$,
         :wifi, :ana || '/' || :wifi || '/foto.webp'),
  '23514', null, 'ni fotos');

select throws_ok(
  format($$insert into public.item_links (item_id, url, position) values (%L, 'https://a.es', 1000)$$,
         :wifi),
  '23514', null, 'ni varios enlaces');

select throws_ok(
  format($$update public.items set protected = true, notes = null, sealed_notes = %L,
           sealed_iv = %L, sealed_key_id = gen_random_uuid() where id = %L$$, :sealed, :iv, :alarma),
  '23514', null, 'se cifra con la clave de la caja de ahora, no con otra');

select lives_ok(
  format($$update public.items set title = 'Wifi de casa (router)' where id = %L$$, :wifi),
  'cambiar la primera línea de una protegida, sí');

select lives_ok(
  format($$update public.items set sealed_notes = %L where id = %L$$, :other, :wifi),
  'y su texto, cifrado otra vez con la de ahora');

-- ─── Quitar la protección ────────────────────────────────────────────────────────────────────

update public.items
set protected = false, notes = 'Clave: tq8M-29xk-Lp4r', sealed_notes = null, sealed_iv = null,
    sealed_key_id = null
where id = :wifi;
select results_eq(
  format('select protected, notes from public.items where id = %L', :wifi),
  $$values (false, 'Clave: tq8M-29xk-Lp4r'::text)$$,
  'quitar la protección la deja como una nota de siempre');

update public.items
set protected = true, notes = null, sealed_notes = :sealed, sealed_iv = :iv,
    sealed_key_id = :'ana_key'
where id = :wifi;

-- ─── Lo compartido ───────────────────────────────────────────────────────────────────────────

select throws_ok(
  format($$update public.items set protected = true, notes = null, sealed_notes = %L,
           sealed_iv = %L, sealed_key_id = %L where id = %L$$, :sealed, :iv, :'ana_key', :super),
  '23514', null, 'en una lista compartida no se protege (Bea no tiene la clave)');

select throws_ok(
  format($$update public.items set list_id = %L where id = %L$$, :compras, :wifi),
  '23514', null, 'ni se mueve una protegida a una lista compartida');

select is(public.list_has_protected(:casa), true, '«Casa» tiene protegidas');
select is(public.list_is_shared(:compras), true, '«Compras» está compartida');

select throws_ok(
  format('select * from public.create_list_invite(%L)', :casa),
  '42501', 'Una lista con notas protegidas no se comparte.',
  'una lista con protegidas no se comparte');

-- Un enlace de antes de protegerla ya no vale.
reset role;
insert into public.list_invites (list_id, token, created_by)
values (:casa, 'enlace-de-antes-57', :ana);
:as_bea
select results_eq(
  $$select status from public.accept_list_invite('enlace-de-antes-57')$$,
  $$values ('revoked'::text)$$,
  'Bea no entra con un enlace de antes: la lista tiene protegidas');
reset role;
select is_empty(format('select 1 from public.list_members where list_id = %L', :casa),
  'y no queda dentro');

-- ─── Restaurar y duplicar ────────────────────────────────────────────────────────────────────

:as_ana
select title as wifi_title from public.items where id = :wifi \gset
delete from public.items where id = :wifi;
insert into public.items (id, list_id, created_by, kind, title, status, position, protected,
                          sealed_notes, sealed_iv, sealed_key_id)
values (:wifi, :casa, :ana, 'note', :'wifi_title', 'pending', 1000, true, :sealed, :iv,
        gen_random_uuid());
select results_eq(
  format('select protected, sealed_notes from public.items where id = %L', :wifi),
  format('values (true, %L::text)', :sealed),
  '«Deshacer» un borrado la trae tal cual, aunque fuera de la clave de antes');
update public.items set sealed_key_id = :'ana_key' where id = :wifi;

select (public.duplicate_list(:casa, 'Casa (copia)') ->> 'list_id') as copia \gset
select results_eq(
  format($$select title, protected, sealed_notes, sealed_key_id::text from public.items
           where list_id = %L and protected$$, :'copia'),
  format('values (%L::text, true, %L::text, %L::text)', :'wifi_title', :sealed, :'ana_key'),
  'duplicar la lista copia la protegida con lo cifrado tal cual');

select * from finish(true);
rollback;
