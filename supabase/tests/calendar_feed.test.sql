-- Sesión 3.7 · Los eventos en el Calendario del iPhone: el enlace de cada uno, qué eventos lee el
-- feed y que cambiar el enlace deja el anterior sin servir. Ana tiene «Agenda»; Bea comparte
-- «Cumples» con Ana; Carlos no tiene nada que ver. En una transacción que se deshace al final.
-- `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a370-00000000000a'''
\set bea   '''00000000-0000-4000-a370-00000000000b'''
\set carlos '''00000000-0000-4000-a370-00000000000c'''
\set agenda '''00000000-0000-4000-a370-0000000000a1'''
\set viejas '''00000000-0000-4000-a370-0000000000a2'''
\set cumples '''00000000-0000-4000-a370-0000000000b1'''
\set suya '''00000000-0000-4000-a370-0000000000c1'''
\set viaje '''00000000-0000-4000-a370-0000000000e1'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-37@example.com', 'Ana'), (:bea, 'bea-37@example.com', 'Bea'),
             (:carlos, 'carlos-37@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a370-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a370-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a370-00000000000c''); set local role authenticated;'
\set as_feed 'reset role; set local role service_role;'

-- ─── El enlace ───────────────────────────────────────────────────────────────────────────────

:as_ana
select public.calendar_token() as token \gset
select matches(:'token'::text, '^[A-Za-z0-9_-]{32}$', 'abrir la hoja crea el enlace: 32 caracteres para URL');
select is(public.calendar_token(), :'token', 'y abrirla otra vez da el mismo');
select results_eq('select token from public.calendar_feeds', format('values (%L)', :'token'),
  'Ana ve el suyo');
select throws_ok($$insert into public.calendar_feeds (user_id, token)
                   values ('00000000-0000-4000-a370-00000000000a', repeat('a', 32))$$,
  '42501', null, 'y no lo escribe a mano');

:as_bea
select is_empty('select 1 from public.calendar_feeds', 'Bea no ve el de Ana');
select throws_ok(format('select public.calendar_feed(%L)', :'token'), '42501', null,
  'ni puede leer el feed con él desde la app: solo la función');

reset role;
set local role anon;
select throws_ok('select public.calendar_token()', '42501', null, 'sin sesión no hay enlace');

-- ─── Lo que entra ────────────────────────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:agenda, :ana, 'Agenda', 'amber', 'events', 9000),
       (:viejas, :ana, 'Viejas', 'teal', 'events', 9001);
insert into public.items (list_id, kind, title, notes, status, created_by, due_at, all_day, recurrence)
values
  (:agenda, 'event', 'Cena con Marta', 'Reservado; a las 21', 'upcoming', :ana,
   '2026-11-13 21:00 Europe/Madrid', false, null),
  (:agenda, 'event', 'Puente', null, 'upcoming', :ana, '2026-12-07 00:00 Europe/Madrid', true, null),
  (:agenda, 'event', 'Reunión de equipo', null, 'upcoming', :ana,
   '2026-11-02 10:00 Europe/Madrid', false, 'FREQ=MONTHLY;BYDAY=1MO'),
  (:agenda, 'event', 'Concierto cancelado', null, 'cancelled', :ana,
   '2026-11-20 20:00 Europe/Madrid', false, null),
  (:agenda, 'event', 'Algún día', null, 'upcoming', :ana, null, false, null),
  (:agenda, 'task', 'Comprar entradas', null, 'pending', :ana, '2026-11-10 00:00 Europe/Madrid', true, null),
  (:viejas, 'event', 'De una lista archivada', null, 'upcoming', :ana,
   '2026-11-15 12:00 Europe/Madrid', false, null);
-- Una sublista terminada con un evento dentro: como en Hoy, no sale.
insert into public.items (id, list_id, kind, title, status, created_by)
values (:viaje, :agenda, 'sublist', 'Viaje a Lisboa', 'pending', :ana);
insert into public.items (list_id, parent_id, kind, title, status, created_by, due_at)
values (:agenda, :viaje, 'event', 'Vuelo a Lisboa', 'upcoming', :ana, '2026-11-21 07:00 Europe/Madrid');
update public.items set status = 'done' where id = :viaje;
update public.lists set archived_at = now() where id = :viejas;

:as_bea
insert into public.lists (id, owner_id, name, color, kind, position)
values (:cumples, :bea, 'Cumples', 'pink', 'events', 9000);
insert into public.items (list_id, kind, title, status, created_by, due_at, all_day, recurrence)
values (:cumples, 'event', 'Cumple de Bea', 'upcoming', :bea, '2024-02-29 00:00 Europe/Madrid', true,
        'FREQ=YEARLY');
select invite_token as invite from public.create_list_invite(:cumples) \gset
:as_ana
select public.accept_list_invite(:'invite');

:as_carlos
insert into public.lists (id, owner_id, name, color, kind, position)
values (:suya, :carlos, 'Lo de Carlos', 'blue', 'events', 9000);
insert into public.items (list_id, kind, title, status, created_by, due_at)
values (:suya, 'event', 'Dentista de Carlos', 'upcoming', :carlos, '2026-11-12 09:00 Europe/Madrid');

:as_feed
select is(public.calendar_feed(:'token') ->> 'timezone', 'Europe/Madrid', 'el feed va en la zona de Ana');
select results_eq(
  format($$select e ->> 'title', e ->> 'list_name', e ->> 'start', (e ->> 'all_day')::boolean,
                  e ->> 'recurrence', e ->> 'notes'
           from jsonb_array_elements(public.calendar_feed(%L) -> 'events') e$$, :'token'),
  $$values ('Cumple de Bea', 'Cumples', '2024-02-29', true, 'FREQ=YEARLY', null::text),
           ('Reunión de equipo', 'Agenda', '2026-11-02T10:00:00', false, 'FREQ=MONTHLY;BYDAY=1MO', null),
           ('Cena con Marta', 'Agenda', '2026-11-13T21:00:00', false, null, 'Reservado; a las 21'),
           ('Puente', 'Agenda', '2026-12-07', true, null, null)$$,
  'sus eventos con fecha y los de «Cumples», en su hora; ni tareas, ni cancelados, ni archivados, ni los de Carlos, ni los de una sublista terminada');

:as_bea
select public.calendar_token() as bea_token \gset
:as_feed
select results_eq(
  format($$select e ->> 'title' from jsonb_array_elements(public.calendar_feed(%L) -> 'events') e$$,
         :'bea_token'),
  $$values ('Cumple de Bea')$$, 'Bea ve lo de su lista y nada de la de Ana');

select is(public.calendar_feed('desconocido-desconocido-descono'), null,
  'un enlace que no existe no da nada (la función contesta 404)');

-- ─── Cambiar el enlace ───────────────────────────────────────────────────────────────────────

:as_ana
select public.rotate_calendar_token() as new_token \gset
select isnt(:'new_token'::text, :'token'::text, '«Cambiar enlace» da otro');
select is(public.calendar_token(), :'new_token', 'y es el que enseña la hoja desde entonces');
:as_feed
select is(public.calendar_feed(:'token'), null, 'el anterior deja de servir en ese momento');
select is(jsonb_array_length(public.calendar_feed(:'new_token') -> 'events'), 4,
  'el nuevo lee lo mismo');

-- ─── Al borrar la cuenta ─────────────────────────────────────────────────────────────────────

:as_carlos
select public.calendar_token() as carlos_token \gset
reset role;
delete from auth.users where id = :carlos;
select is_empty(format('select 1 from public.calendar_feeds where user_id = %L', :carlos),
  'el enlace se va con la cuenta');

select * from finish(true);
rollback;
