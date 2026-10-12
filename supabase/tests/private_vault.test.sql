-- Sesión 5.6 · La clave privada (ADR-013): cada uno ve y cambia solo su caja; cambiar la clave
-- privada no cambia la clave de la caja ni su comprobador; una llave guarda la caja de ahora; crear
-- otra porque se olvidó pide haber entrado con un código por email hace poco, y se lleva las
-- llaves de antes. Ana tiene su caja; Carlos no tiene nada que ver. En una transacción que se
-- deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a560-00000000000a'''
\set carlos '''00000000-0000-4000-a560-00000000000c'''
\set llave  '''00000000-0000-4000-a560-0000000000b1'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-56@example.com', 'Ana'),
             (:carlos, 'carlos-56@example.com', 'Carlos')) as u(id, email, name);

-- Los claims de quien pregunta; con `code_minutes`, entró con un código por email hace tantos
-- minutos (el `amr` del JWT de Supabase).
create function pg_temp.claims(uid uuid, code_minutes integer default null) returns text
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object(
      'sub', uid, 'role', 'authenticated',
      'amr', case when code_minutes is null
                  then json_build_array(json_build_object('method', 'password',
                         'timestamp', extract(epoch from now())::bigint))
                  else json_build_array(json_build_object('method', 'otp',
                         'timestamp', extract(epoch from now() - make_interval(mins => code_minutes))::bigint))
             end)::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a560-00000000000a''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a560-00000000000c''); set local role authenticated;'

-- Valores con la forma de los de verdad (base64 de 16, 12, 48 y 32 bytes).
\set salt  '''c2FsLWRlLTE2LWJ5dGVzIQ=='''
\set iv    '''aXYtZGUtMTItYnl0'''
\set wrap  '''Y2xhdmUtZGUtbGEtY2FqYS1jaWZyYWRhLWNvbi1sYS1jbGF2ZS1wcml2YWRhISE='''
\set check '''Y29tcHJvYmFkb3ItZGUtMzItYnl0ZXMtc2hhMjU2ISE='''
\set prf   '''c2FsLWRlLXByZi1kZS0zMi1ieXRlcy1hbC1henFyISE='''

-- ─── Crear la caja ───────────────────────────────────────────────────────────────────────────

:as_ana
insert into public.private_vaults (kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
values (600000, :salt, :iv, :wrap, :check);
select results_eq(
  format('select user_id, kdf from public.private_vaults'),
  format('values (%L::uuid, %L::text)', :ana, 'pbkdf2-sha256'),
  'Ana crea su caja, que es suya y con PBKDF2');

select throws_ok(
  format($$insert into public.private_vaults (kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
           values (600000, %L, %L, %L, %L)$$, :salt, :iv, :wrap, :check),
  '23505', null, 'una sola caja por persona');

select throws_ok(
  format($$update public.private_vaults set kdf_iterations = 1000 where user_id = %L$$, :ana),
  '23514', null, 'no se baja de 100 000 iteraciones');

:as_carlos
select is_empty('select 1 from public.private_vaults', 'Carlos no ve la caja de Ana');
select throws_ok(
  format($$insert into public.private_vaults (user_id, kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
           values (%L, 600000, %L, %L, %L, %L)$$, :ana, :salt, :iv, :wrap, :check),
  '42501', null, 'ni la crea por ella');
update public.private_vaults set wrapped_key = :check;
reset role;
-- Solo la de Ana: en la base local puede haber otras cajas de verdad.
select results_eq(format('select wrapped_key from public.private_vaults where user_id = %L', :ana),
  format('values (%L::text)', :wrap), 'ni la cambia');

-- ─── Cambiar la clave privada ────────────────────────────────────────────────────────────────

:as_ana
update public.private_vaults
set kdf_salt = 'b3RyYS1zYWwtZGUtMTYtYg==', wrap_iv = 'b3Ryby12ZWN0b3ItMTI=', wrapped_key = :check;
select results_eq('select wrapped_key from public.private_vaults', format('values (%L::text)', :check),
  'cambiar la clave privada vuelve a cifrar la clave de la caja');
select throws_ok('update public.private_vaults set key_check = ''b3Rybw==''||repeat(''A'', 40)',
  '42501', null, 'el comprobador no cambia');
select throws_ok('update public.private_vaults set key_id = gen_random_uuid()',
  '42501', null, 'ni cuál es la clave de la caja');
select is_empty('delete from public.private_vaults returning 1',
  'la caja no se borra: crear otra es «He olvidado la clave»');

-- ─── Las llaves ──────────────────────────────────────────────────────────────────────────────

insert into public.private_vault_keys (id, credential_id, prf_salt, wrap_iv, wrapped_key, key_id, method, device)
select :llave, 'Y3JlZGVuY2lhbC1kZWwtaXBob25l', :prf, :iv, :wrap, key_id, 'Face ID', 'iPhone'
from public.private_vaults;
select results_eq('select method, device from public.private_vault_keys',
  $$values ('Face ID'::text, 'iPhone'::text)$$, 'Ana añade Face ID de su iPhone');

select throws_ok(
  format($$insert into public.private_vault_keys (credential_id, prf_salt, wrap_iv, wrapped_key, key_id, method, device)
           values ('b3RyYS1jcmVkZW5jaWFs', %L, %L, %L, gen_random_uuid(), 'Touch ID', 'Mac')$$,
         :prf, :iv, :wrap),
  '23503', null, 'una llave guarda la clave de la caja de ahora');

:as_carlos
select is_empty('select 1 from public.private_vault_keys', 'Carlos no ve las llaves de Ana');
select is_empty(format('delete from public.private_vault_keys where id = %L returning 1', :llave),
  'ni las quita');

-- ─── Crear otra porque se olvidó ─────────────────────────────────────────────────────────────

:as_ana
select throws_ok(
  format($$select public.reset_private_vault(600000, %L, %L, %L, %L)$$, :salt, :iv, :wrap, :check),
  '42501', null, 'sin el código por email no se crea otra');

reset role;
select pg_temp.claims(:ana::uuid, 30);
set local role authenticated;
select throws_ok(
  format($$select public.reset_private_vault(600000, %L, %L, %L, %L)$$, :salt, :iv, :wrap, :check),
  '42501', null, 'un código de hace media hora no vale');

reset role;
create temp table antes on commit drop as
  select key_id from public.private_vaults where user_id = :ana;
grant select on antes to authenticated;
select pg_temp.claims(:ana::uuid, 2);
set local role authenticated;
select isnt(
  public.reset_private_vault(600000, :salt, :iv, :wrap, :check),
  (select key_id from antes),
  'con el código de hace dos minutos se crea otra caja, con otra clave');
select results_eq('select count(*)::int from public.private_vaults', 'values (1)',
  'sigue habiendo una');
select is_empty('select 1 from public.private_vault_keys',
  'las llaves de antes se van: guardaban la clave vieja');

reset role;
select pg_temp.claims(:carlos::uuid, 2);
set local role authenticated;
select lives_ok(
  format($$select public.reset_private_vault(600000, %L, %L, %L, %L)$$, :salt, :iv, :wrap, :check),
  'Carlos, con su código, crea la suya');
reset role;
select results_eq(
  format('select count(*)::int from public.private_vaults where user_id = %L', :ana),
  'values (1)', 'y la de Ana sigue ahí');

set local role anon;
select throws_ok(
  format($$select public.reset_private_vault(600000, %L, %L, %L, %L)$$, :salt, :iv, :wrap, :check),
  '42501', null, 'sin sesión, nada');
reset role;

-- ─── Al borrar la cuenta ─────────────────────────────────────────────────────────────────────

delete from auth.users where id = :carlos;
select is_empty(format('select 1 from public.private_vaults where user_id = %L', :carlos),
  'borrar la cuenta borra su caja');

select * from finish(true);
rollback;
