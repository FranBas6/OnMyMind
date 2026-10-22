-- Sesión 6.1 · Documentos: los tipos y el tamaño, como mucho 5, los ven y los añaden los de la
-- lista, no en una nota protegida ni proteger una nota con documentos, el bucket con sus límites,
-- quién abre el archivo, los huérfanos, borrar la cuenta y duplicar. Ana tiene «Casa», compartida
-- con Bea, y «Notas», solo suya (una protegida no va en una compartida); Carlos no tiene nada que
-- ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a610-00000000000a'''
\set bea    '''00000000-0000-4000-a610-00000000000b'''
\set carlos '''00000000-0000-4000-a610-00000000000c'''
\set casa   '''00000000-0000-4000-a610-0000000000a1'''
\set notas  '''00000000-0000-4000-a610-0000000000a2'''
\set revolut '''00000000-0000-4000-a610-0000000000d1'''
\set grifo  '''00000000-0000-4000-a610-0000000000d2'''
\set wifi   '''00000000-0000-4000-a610-0000000000d3'''
\set contrato '''00000000-0000-4000-a610-0000000000d4'''

\set pdf  '''00000000-0000-4000-a610-00000000000a/revolut/plan.pdf'''
\set xlsx '''00000000-0000-4000-a610-00000000000b/revolut/gastos.xlsx'''
\set doc  '''00000000-0000-4000-a610-00000000000a/contrato/contrato.pdf'''

\set mime_pdf  '''application/pdf'''
\set mime_xlsx '''application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-61@example.com', 'Ana'), (:bea, 'bea-61@example.com', 'Bea'),
             (:carlos, 'carlos-61@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a610-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a610-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a610-00000000000c''); set local role authenticated;'

-- Valores con la forma de los de verdad (base64), como en protected_notes.
\set salt   '''c2FsLWRlLTE2LWJ5dGVzIQ=='''
\set iv     '''aXYtZGUtMTItYnl0'''
\set wrap   '''Y2xhdmUtZGUtbGEtY2FqYS1jaWZyYWRhLWNvbi1sYS1jbGF2ZS1wcml2YWRhISE='''
\set check  '''Y29tcHJvYmFkb3ItZGUtMzItYnl0ZXMtc2hhMjU2ISE='''
\set sealed '''dGV4dG8tY2lmcmFkby1kZS1sYS1ub3RhLWRlbC13aWZpLWNvbi1sYS1ldGlxdWV0YQ=='''

:as_ana
insert into public.private_vaults (kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
values (600000, :salt, :iv, :wrap, :check);
insert into public.lists (id, owner_id, name, color, kind, position) values
  (:casa, :ana, 'Casa', 'coral', 'list', 2000),
  (:notas, :ana, 'Notas', 'teal', 'list', 3000);
insert into public.items (id, list_id, created_by, kind, title, notes, status, position) values
  (:revolut, :casa, :ana, 'task', 'Revisar el plan de ahorro de Revolut', null, 'pending', 1000),
  (:grifo, :casa, :ana, 'task', 'Arreglar el grifo', null, 'pending', 2000),
  (:wifi, :notas, :ana, 'note', 'Wifi de casa', 'Clave: tq8M-29xk-Lp4r', 'pending', 3000),
  (:contrato, :notas, :ana, 'note', 'Contrato del alquiler', 'Firmado el 1 de marzo', 'pending',
   4000);
reset role;
select key_id as ana_key from public.private_vaults where user_id = :ana \gset

-- ─── Añadir: el tipo, el tamaño y el nombre ──────────────────────────────────────────────────

:as_ana
insert into public.item_files (item_id, path, name, mime, size_bytes, position)
values (:revolut, :pdf, 'Plan de ahorro Revolut.pdf', :mime_pdf, 1258291, 1000);
select is((select count(*)::integer from public.item_files where item_id = :revolut), 1,
  'Ana adjunta el PDF del plan de ahorro');
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'a/b.zip', 'Copias.zip', 'application/zip', 1000)$$, :revolut),
  '23514', null, 'un .zip no vale');
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'a/b.pdf', 'Escrituras.pdf', %L, 8388608)$$, :revolut, :mime_pdf),
  '23514', null, 'de más de 5 MB, tampoco');
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'a/b.pdf', '   ', %L, 1000)$$, :revolut, :mime_pdf),
  '23514', null, 'ni sin nombre');

-- ─── Los de la lista ─────────────────────────────────────────────────────────────────────────

reset role;
insert into public.list_members (list_id, user_id, role, accepted_at, position)
values (:casa, :bea, 'editor', now(), 3000);

:as_bea
insert into public.item_files (item_id, path, name, mime, size_bytes, position)
values (:revolut, :xlsx, 'Gastos del trimestre.xlsx', :mime_xlsx, 86016, 2000);
select is((select count(*)::integer from public.item_files where item_id = :revolut), 2,
  'Bea, que está en la lista, ve el de Ana y añade un Excel');
select ok(public.can_see_file(:pdf), 'y puede abrir el archivo de Ana');

:as_carlos
select is_empty(format('select 1 from public.item_files where item_id = %L', :revolut),
  'Carlos no ve los documentos de una lista que no es suya');
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'c/x.pdf', 'x.pdf', %L, 1000)$$, :revolut, :mime_pdf),
  '42501', null, 'ni los añade');
select ok(not public.can_see_file(:pdf), 'ni puede abrir el archivo');

-- ─── Añadir uno toca la cosa (el directo) ────────────────────────────────────────────────────

reset role;
update public.items set updated_at = now() - interval '1 day' where id = :grifo;
:as_ana
insert into public.item_files (item_id, path, name, mime, size_bytes)
values (:grifo, 'x/1.pdf', '1.pdf', :mime_pdf, 1000);
select ok((select updated_at > now() - interval '1 minute' from public.items where id = :grifo),
  'añadir un documento toca su cosa, para que el directo avise');

-- ─── Como mucho 5 ────────────────────────────────────────────────────────────────────────────

insert into public.item_files (item_id, path, name, mime, size_bytes, position)
select :grifo, 'x/' || n || '.pdf', n || '.pdf', :mime_pdf, 1000, n * 1000
from generate_series(2, 5) n;
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'x/6.pdf', '6.pdf', %L, 1000)$$, :grifo, :mime_pdf),
  '23514', null, 'el sexto no entra');

-- ─── Las notas protegidas ────────────────────────────────────────────────────────────────────

update public.items
set protected = true, notes = null, sealed_notes = :sealed, sealed_iv = :iv,
    sealed_key_id = :'ana_key'
where id = :wifi;
select throws_ok(
  format($$insert into public.item_files (item_id, path, name, mime, size_bytes)
           values (%L, 'x/w.pdf', 'w.pdf', %L, 1000)$$, :wifi, :mime_pdf),
  '23514', null, 'una nota protegida no lleva documentos');

insert into public.item_files (item_id, path, name, mime, size_bytes)
values (:contrato, :doc, 'Contrato de alquiler firmado.pdf', :mime_pdf, 2936012);
select throws_ok(
  format($$update public.items set protected = true, notes = null, sealed_notes = %L,
           sealed_iv = %L, sealed_key_id = %L where id = %L$$,
         :sealed, :iv, :'ana_key', :contrato),
  '23514', null, 'y una nota con documentos no se protege');
delete from public.item_files where item_id = :contrato;
update public.items
set protected = true, notes = null, sealed_notes = :sealed, sealed_iv = :iv,
    sealed_key_id = :'ana_key'
where id = :contrato;
select ok((select protected from public.items where id = :contrato),
  'quitándolos, sí');

-- ─── El bucket ───────────────────────────────────────────────────────────────────────────────

reset role;
select results_eq(
  $$select public, file_size_limit, allowed_mime_types = public.item_file_types()
    from storage.buckets where id = 'item-files'$$,
  $$values (false, 5242880::bigint, true)$$,
  'el bucket es privado, de 5 MB y con los mismos tipos');

-- ─── Los huérfanos y borrar la cuenta ────────────────────────────────────────────────────────

insert into storage.objects (bucket_id, name, owner, created_at) values
  ('item-files', :pdf, :ana, now() - interval '1 hour'),
  ('item-files', '00000000-0000-4000-a610-00000000000a/revolut/viejo.pdf', :ana,
   now() - interval '1 hour'),
  ('item-files', '00000000-0000-4000-a610-00000000000a/revolut/recien.pdf', :ana, now());

:as_ana
select results_eq('select public.orphan_files()',
  $$values ('00000000-0000-4000-a610-00000000000a/revolut/viejo.pdf')$$,
  'huérfano, solo el que no usa nadie y no se acaba de subir');
select is((select count(*)::integer from public.own_files()), 3,
  'own_files da todos los de su carpeta');
select throws_ok('select public.delete_own_account()', '55000', null,
  'con documentos en el bucket, la cuenta no se borra');

-- ─── Duplicar los devuelve ───────────────────────────────────────────────────────────────────

select public.duplicate_list(:casa, 'Casa (2)') as result \gset
select is(
  (select jsonb_agg(f ->> 'name' order by (f ->> 'position')::integer)
   from jsonb_array_elements(:'result'::jsonb -> 'files') f
   where (f ->> 'item_id')::uuid = (select id from public.items
                                    where list_id = (:'result'::jsonb ->> 'list_id')::uuid
                                      and title = 'Revisar el plan de ahorro de Revolut')),
  jsonb_build_array('Plan de ahorro Revolut.pdf', 'Gastos del trimestre.xlsx'),
  'duplicar devuelve los dos documentos del plan de ahorro, en su orden');

-- ─── Borrar ──────────────────────────────────────────────────────────────────────────────────

delete from public.items where id = :revolut;
select is_empty(format('select 1 from public.item_files where item_id = %L', :revolut),
  'borrar la cosa se lleva sus documentos');

select * from finish(true);
rollback;
