-- Sesión 3.6 · Repetición personalizada, también en tareas: qué reglas admite la base, qué pasa al
-- completar una tarea que se repite, deshacerlo y quién ve las veces hechas. Ana comparte «Casa» con
-- Bea; Carlos no tiene nada que ver. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a360-00000000000a'''
\set bea   '''00000000-0000-4000-a360-00000000000b'''
\set carlos '''00000000-0000-4000-a360-00000000000c'''
\set casa '''00000000-0000-4000-a360-0000000000c1'''
\set basura '''00000000-0000-4000-a360-0000000000e1'''
\set plantas '''00000000-0000-4000-a360-0000000000e2'''
\set suelta '''00000000-0000-4000-a360-0000000000e3'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-36@example.com', 'Ana'), (:bea, 'bea-36@example.com', 'Bea'),
             (:carlos, 'carlos-36@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a360-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a360-00000000000b''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a360-00000000000c''); set local role authenticated;'
\set as_admin 'reset role;'

-- ─── Qué reglas admite ───────────────────────────────────────────────────────────────────────

select ok(public.recurrence_is_valid(r), 'vale: ' || r) from unnest(array[
  'FREQ=DAILY', 'FREQ=DAILY;INTERVAL=3', 'FREQ=WEEKLY', 'FREQ=WEEKLY;BYDAY=TU,FR',
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH', 'FREQ=MONTHLY;BYDAY=1MO', 'FREQ=MONTHLY;BYDAY=-1FR',
  'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=31', 'FREQ=YEARLY;INTERVAL=2']) r;
select ok(not public.recurrence_is_valid(r), 'no vale: ' || r) from unnest(array[
  'weekly', 'FREQ=HOURLY', 'FREQ=DAILY;INTERVAL=1', 'FREQ=DAILY;INTERVAL=0', 'FREQ=DAILY;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=MOTU', 'FREQ=WEEKLY;BYDAY=FR,TU', 'FREQ=WEEKLY;BYDAY=MO,MO',
  'FREQ=WEEKLY;BYDAY=', 'FREQ=WEEKLY;BYDAY=1MO', 'FREQ=MONTHLY;BYDAY=5MO',
  'FREQ=MONTHLY;BYMONTHDAY=32', 'FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=3', 'FREQ=WEEKLY;COUNT=3']) r;
select is(public.recurrence_rule('monthly'), 'FREQ=MONTHLY', 'lo de antes se lee como su regla');
select is_empty($$select 1 from public.items where recurrence !~ '^FREQ='$$,
  'la migración pasó lo de antes a reglas');

-- ─── Ana comparte «Casa» con Bea ─────────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:casa, :ana, 'Casa 36', 'coral', 'tasks', 9000);
select invite_token as token from public.create_list_invite(:casa) \gset
:as_bea
select public.accept_list_invite(:'token');

-- Una tarea de martes y viernes que vence hoy, otra cada 3 días que vence ayer, y una suelta.
:as_ana
insert into public.items (id, list_id, kind, title, status, created_by, due_at, all_day, recurrence)
values
  (:basura, :casa, 'task', 'Sacar la basura', 'pending', :ana,
   date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid', true,
   'FREQ=DAILY;INTERVAL=7'),
  (:plantas, :casa, 'task', 'Regar las plantas', 'pending', :ana,
   (date_trunc('day', now() at time zone 'Europe/Madrid') - interval '1 day')
     at time zone 'Europe/Madrid', true, 'FREQ=DAILY;INTERVAL=3'),
  (:suelta, :casa, 'task', 'Llamar al seguro', 'pending', :ana,
   date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid', true, null);

select throws_ok(
  $$update public.items set recurrence = 'FREQ=WEEKLY;BYDAY=FR,TU' where title = 'Llamar al seguro'$$,
  '23514', null, 'una regla mal escrita no entra');

-- ─── Completar una que se repite ─────────────────────────────────────────────────────────────

:as_bea
update public.items set status = 'done' where id = :basura;
:as_admin
select results_eq(
  format($$select status, (due_at at time zone 'Europe/Madrid')::date - (now() at time zone 'Europe/Madrid')::date,
                  completed_at is null
           from public.items where id = %L$$, :basura),
  $$values ('pending', 7, true)$$,
  'Bea la completa hoy: sigue pendiente y pasa a dentro de una semana');
select results_eq(
  format($$select done_by, (occurrence at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date
           from public.item_completions where item_id = %L$$, :basura),
  format('values (%L::uuid, true)', :bea),
  'queda la vez hecha, por Bea y con la fecha que tenía');

update public.items set status = 'done' where id = :plantas;
select results_eq(
  format($$select (due_at at time zone 'Europe/Madrid')::date - (now() at time zone 'Europe/Madrid')::date
           from public.items where id = %L$$, :plantas),
  $$values (2)$$,
  'una atrasada (cada 3 días, de ayer) no se queda para hoy: a la siguiente, pasado mañana');

update public.items set status = 'done' where id = :suelta;
select results_eq(
  format($$select status, completed_at is not null from public.items where id = %L$$, :suelta),
  $$values ('done', true)$$, 'una que no se repite se completa como siempre');
select is_empty(format('select 1 from public.item_completions where item_id = %L', :suelta),
  'y no deja vez hecha');

-- ─── El aviso se mueve con la fecha ──────────────────────────────────────────────────────────

:as_ana
insert into public.reminders (item_id, user_id, remind_at, offset_minutes)
values (:basura, :ana, now(), -600);
update public.items set status = 'done' where id = :basura;
:as_admin
select results_eq(
  format($$select (r.remind_at at time zone 'Europe/Madrid') = (i.due_at at time zone 'Europe/Madrid') + interval '10 hours'
           from public.reminders r join public.items i on i.id = r.item_id where r.item_id = %L$$,
         :basura),
  $$values (true)$$, 'el aviso de las 10:00 pasa a la nueva fecha');

-- ─── Quién ve las veces hechas y deshacer ────────────────────────────────────────────────────

:as_carlos
select is_empty('select 1 from public.item_completions', 'Carlos no ve las veces hechas de Casa');
select public.undo_repeat(:basura);
:as_admin
select results_eq(format('select count(*)::int from public.item_completions where item_id = %L', :basura),
  $$values (2)$$, 'ni puede deshacerlas');

:as_ana
select results_eq(format('select count(*)::int from public.item_completions where item_id = %L', :basura),
  $$values (2)$$, 'Ana ve las dos veces que se sacó la basura');
select public.undo_repeat(:basura);
:as_admin
select results_eq(
  format($$select (due_at at time zone 'Europe/Madrid')::date - (now() at time zone 'Europe/Madrid')::date,
                  (select count(*)::int from public.item_completions where item_id = %L)
           from public.items where id = %L$$, :basura, :basura),
  $$values (7, 1)$$, 'Ana deshace la última: vuelve a la fecha que tenía y se borra esa vez');

select * from finish(true);
rollback;
