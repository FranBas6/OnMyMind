-- Sesión 5.8 · Listas ocultas (ADR-013): ocultar es de cada uno; quien la oculta no la recibe en
-- las consultas de siempre (sus listas, sus ítems, el resumen de Hoy, el Calendario, «Bajaron esta
-- mañana») y sus avisos le llegan sin título; los demás la ven como siempre. Ana tiene «Regalos»,
-- compartida con Bea, y «Casa»; Carlos no tiene nada que ver. En una transacción que se deshace al
-- final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana     '''00000000-0000-4000-a580-00000000000a'''
\set bea     '''00000000-0000-4000-a580-00000000000b'''
\set carlos  '''00000000-0000-4000-a580-00000000000c'''
\set regalos '''00000000-0000-4000-a580-0000000000a1'''
\set casa    '''00000000-0000-4000-a580-0000000000a2'''
\set cena    '''00000000-0000-4000-a580-0000000000e1'''
\set aniv    '''00000000-0000-4000-a580-0000000000e2'''
\set pendientes '''00000000-0000-4000-a580-0000000000e3'''
\set tarta   '''00000000-0000-4000-a580-0000000000e4'''
\set grifo   '''00000000-0000-4000-a580-0000000000e5'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-58@example.com', 'Ana'), (:bea, 'bea-58@example.com', 'Bea'),
             (:carlos, 'carlos-58@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a580-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a580-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a580-00000000000c''); set local role authenticated;'
\set as_fn 'reset role; set local role service_role;'

-- Hoy, en Madrid: la tarea y el evento de hoy, y el resumen a esta hora.
select to_char(now() at time zone 'Europe/Madrid', 'HH24:MI') as summary_time \gset

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position) values
  (:regalos, :ana, 'Regalos', 'pink', 'list', 9000),
  (:casa, :ana, 'Casa 58', 'coral', 'list', 9001);
insert into public.items (id, list_id, created_by, kind, title, status, position, due_at, all_day,
                          url, price_cents, price_source) values
  (:cena, :regalos, :ana, 'task', 'Reservar la cena', 'pending', 1000, now(), false, null, null,
   null),
  (:aniv, :regalos, :ana, 'event', 'Aniversario', 'upcoming', 2000,
   now() + interval '10 days', false, null, null, null),
  (:pendientes, :regalos, :ana, 'shopping', 'Pendientes de plata', 'pending', 3000, null, false,
   'https://joyeria.es/p', 9000, 'web'),
  (:tarta, :regalos, :ana, 'task', 'Encargar la tarta', 'pending', 4000, null, false, null, null,
   null),
  (:grifo, :casa, :ana, 'task', 'Arreglar el grifo', 'pending', 1000, now(), false, null, null,
   null);
update public.profiles set settings = settings || jsonb_build_object('default_list_id', :regalos)
where id = :ana;
select invite_token as token from public.create_list_invite(:regalos) \gset
:as_bea
select public.accept_list_invite(:'token') as _ \gset

-- ─── Ocultar ─────────────────────────────────────────────────────────────────────────────────

:as_ana
select lives_ok(format('insert into public.hidden_lists (list_id) values (%L)', :regalos),
  'Ana oculta «Regalos»');
select results_eq(
  format('select name, hidden from public.my_lists where id in (%L, %L) order by name',
         :regalos, :casa),
  $$values ('Casa 58', false), ('Regalos', true)$$,
  'en sus listas, «Regalos» va marcada como oculta');
select is_empty(
  format('select 1 from public.my_lists where not hidden and id = %L', :regalos),
  'y las de siempre (sin las ocultas) no la traen');
select is(
  (select p.settings ->> 'default_list_id' from public.profiles p where p.id = :ana),
  (select l.id::text from public.lists l where l.owner_id = :ana and l.kind = 'inbox'),
  'era la lista por defecto de la captura: vuelve a «En mente»');
select results_eq(
  format($$select title from public.items i
           where i.list_id in (%L, %L) and not public.in_hidden_list(i) order by title$$,
         :regalos, :casa),
  $$values ('Arreglar el grifo')$$,
  'sus ítems, para Ana, están en una lista oculta (Hoy y Buscar no los piden)');

select throws_ok(
  format($$insert into public.hidden_lists (list_id)
           select id from public.lists where owner_id = %L and kind = 'inbox'$$, :ana),
  '42501', null, '«En mente» no se oculta');
select throws_ok(
  format('insert into public.hidden_lists (user_id, list_id) values (%L, %L)', :bea, :casa),
  '42501', null, 'ni se oculta nada por otra persona');
:as_carlos
select throws_ok(format('insert into public.hidden_lists (list_id) values (%L)', :regalos),
  '42501', null, 'Carlos no oculta una lista que no ve');

-- ─── Para Bea, como siempre ──────────────────────────────────────────────────────────────────

:as_bea
select results_eq(format('select hidden from public.my_lists where id = %L', :regalos),
  'values (false)', 'Bea, con quien está compartida, la ve como siempre');
select is_empty('select 1 from public.hidden_lists', 'y no ve lo que oculta Ana');
select is(
  (select count(*)::integer from public.items i
   where i.list_id = :regalos and not public.in_hidden_list(i)),
  4, 'sus ítems le salen en Hoy y en Buscar');
delete from public.hidden_lists where list_id = :regalos;
:as_ana
select isnt_empty(format('select 1 from public.hidden_lists where list_id = %L', :regalos),
  'Bea no puede mostrarla por Ana');

-- ─── Los avisos, sin título ──────────────────────────────────────────────────────────────────

:as_ana
insert into public.reminders (item_id, remind_at) values (:cena, now() - interval '1 minute');
:as_bea
insert into public.reminders (item_id, remind_at) values (:tarta, now() - interval '1 minute');
:as_fn
create temp table claimed on commit drop as select * from public.claim_due_reminders(1000);
select results_eq(
  format($$select title, concealed from claimed where item_id in (%L, %L) order by title$$,
         :cena, :tarta),
  $$values ('Encargar la tarta', false), ('Reservar la cena', true)$$,
  'el aviso de Ana sale sin título (la tiene oculta); el de Bea, como siempre');

-- ─── El resumen de Hoy, sin ella ─────────────────────────────────────────────────────────────

reset role;
update public.profiles
set settings = settings || jsonb_build_object('daily_summary_time', :'summary_time'),
    summary_sent_on = null
where id in (:ana, :bea);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  (:ana, 'https://push.example.com/ana-58', 'p256dh', 'auth'),
  (:bea, 'https://push.example.com/bea-58', 'p256dh', 'auth');
:as_fn
create temp table summaries on commit drop as select * from public.claim_daily_summaries();
select results_eq(
  format($$select user_id = %L, title from summaries where user_id in (%L, %L)
           order by user_id = %L desc, title$$, :ana, :ana, :bea, :ana),
  $$values (true, 'Arreglar el grifo'), (false, 'Reservar la cena')$$,
  'el resumen de Ana no cuenta lo de «Regalos»; el de Bea, sí');

-- ─── El Calendario, sin ella ─────────────────────────────────────────────────────────────────

:as_ana
select public.calendar_token() as ana_feed \gset
:as_bea
select public.calendar_token() as bea_feed \gset
:as_fn
select is_empty(
  format($$select 1 from jsonb_array_elements(public.calendar_feed(%L) -> 'events') e
           where e ->> 'title' = 'Aniversario'$$, :'ana_feed'),
  'en el Calendario de Ana no sale el aniversario');
select isnt_empty(
  format($$select 1 from jsonb_array_elements(public.calendar_feed(%L) -> 'events') e
           where e ->> 'title' = 'Aniversario'$$, :'bea_feed'),
  'en el de Bea, sí');

-- ─── Las bajadas de precio ───────────────────────────────────────────────────────────────────

:as_ana
insert into public.price_alerts (item_id, user_id) values (:pendientes, :ana);
:as_bea
insert into public.price_alerts (item_id, user_id) values (:pendientes, :bea);
reset role;
update public.profiles set settings = settings || '{"price_drop_alerts": true}'
where id in (:ana, :bea);
:as_fn
select results_eq(
  format($$select recipients = array[%L, %L]::uuid[], concealed_for
           from public.record_price_check('item', %L, 7900)$$, :ana, :bea, :pendientes),
  format($$values (true, array[%L::uuid])$$, :ana),
  'baja: avisa a las dos, y a Ana sin título');
:as_ana
select is_empty('select 1 from public.my_price_drops()',
  '«Bajaron esta mañana» de Ana no la trae: se ve dentro de la lista');
:as_bea
select results_eq('select title from public.my_price_drops()', $$values ('Pendientes de plata')$$,
  'la de Bea, sí');

-- ─── Duplicar ────────────────────────────────────────────────────────────────────────────────

:as_ana
select (public.duplicate_list(:regalos, 'Regalos (copia)') ->> 'list_id') as ana_copy \gset
select results_eq(format('select hidden from public.my_lists where id = %L', :'ana_copy'),
  'values (true)', 'la copia de una oculta, también oculta');
:as_bea
select (public.duplicate_list(:regalos, 'Regalos de Bea') ->> 'list_id') as bea_copy \gset
select results_eq(format('select hidden from public.my_lists where id = %L', :'bea_copy'),
  'values (false)', 'Bea, que no la oculta, la duplica como siempre');

-- ─── Mostrar y salir ─────────────────────────────────────────────────────────────────────────

:as_ana
delete from public.hidden_lists where list_id = :regalos;
select results_eq(format('select hidden from public.my_lists where id = %L', :regalos),
  'values (false)', '«Mostrar» la devuelve a sus listas');

:as_bea
insert into public.hidden_lists (list_id) values (:regalos);
select results_eq(format('select hidden from public.my_lists where id = %L', :regalos),
  'values (true)', 'Bea también puede ocultarla, para ella');
:as_ana
select results_eq(format('select hidden from public.my_lists where id = %L', :regalos),
  'values (false)', 'y para Ana sigue a la vista');
delete from public.list_members where list_id = :regalos and user_id = :bea;
reset role;
select is_empty(format('select 1 from public.hidden_lists where user_id = %L', :bea),
  'si Ana quita a Bea, Bea deja de tenerla oculta');

-- ─── Permisos ────────────────────────────────────────────────────────────────────────────────

:as_ana
select throws_ok('select * from public.claim_due_reminders()', '42501', null,
  'desde la app no se reclaman avisos');

select * from finish(true);
rollback;
