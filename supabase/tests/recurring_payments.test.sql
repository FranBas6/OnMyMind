-- Sesión 6.3 · Pagos que se repiten: pagar salta al siguiente cobro y apunta lo pagado, la prueba
-- gratis, lo que suman al año y los avisos de las compras. Ana comparte «Gastos» con Bea; dentro,
-- la sublista «Suscripciones». En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a630-00000000000a'''
\set bea   '''00000000-0000-4000-a630-00000000000b'''
\set gastos '''00000000-0000-4000-a630-0000000000c1'''
\set subs '''00000000-0000-4000-a630-0000000000d1'''
\set netflix '''00000000-0000-4000-a630-0000000000e1'''
\set spotify '''00000000-0000-4000-a630-0000000000e2'''
\set seguro '''00000000-0000-4000-a630-0000000000e3'''
\set disney '''00000000-0000-4000-a630-0000000000e4'''
\set hbo '''00000000-0000-4000-a630-0000000000e5'''
\set luz '''00000000-0000-4000-a630-0000000000e6'''
\set multa '''00000000-0000-4000-a630-0000000000e7'''
\set cascos '''00000000-0000-4000-a630-0000000000e8'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-63@example.com', 'Ana'), (:bea, 'bea-63@example.com', 'Bea'))
  as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
-- El día de hoy en Madrid más `n` días, a las 00:00: la fecha de un pago (de día entero).
create function pg_temp.day(n integer) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Europe/Madrid') + make_interval(days => n))
         at time zone 'Europe/Madrid'
$$;
create function pg_temp.days_from_today(at timestamptz) returns integer language sql as $$
  select (at at time zone 'Europe/Madrid')::date - (now() at time zone 'Europe/Madrid')::date
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a630-00000000000a''); set local role authenticated;'
\set as_bea 'reset role; select pg_temp.claims(''00000000-0000-4000-a630-00000000000b''); set local role authenticated;'
\set as_admin 'reset role;'

-- ─── Cuántas veces al año ────────────────────────────────────────────────────────────────────

select is(public.recurrence_per_year(r), n::numeric, r || ' pasa ' || n || ' veces al año')
from (values ('FREQ=MONTHLY', 12), ('FREQ=YEARLY', 1), ('FREQ=DAILY', 365), ('FREQ=WEEKLY', 52),
             ('FREQ=WEEKLY;BYDAY=TU,FR', 104), ('FREQ=MONTHLY;INTERVAL=3', 4),
             ('FREQ=MONTHLY;BYDAY=-1FR', 12), ('monthly', 12)) as t(r, n);
select is(public.recurrence_per_year('FREQ=YEARLY;INTERVAL=2'), 0.5, 'cada dos años, media vez');
select is(public.recurrence_per_year('FREQ=HOURLY'), null, 'una regla que no se entiende, nada');

-- ─── «Gastos», con «Suscripciones» dentro ────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:gastos, :ana, 'Gastos 63', 'amber', 'shopping', 9000);
select invite_token as token from public.create_list_invite(:gastos) \gset
:as_bea
select public.accept_list_invite(:'token');

:as_ana
insert into public.items (id, list_id, kind, title, status, created_by, position)
values (:subs, :gastos, 'sublist', 'Suscripciones', 'pending', :ana, 1000);

insert into public.items (id, list_id, parent_id, kind, title, status, created_by, due_at, all_day,
                          recurrence, price_cents, currency, trial, position)
values
  (:netflix, :gastos, :subs, 'shopping', 'Netflix', 'pending', :ana, pg_temp.day(18), true,
   'FREQ=MONTHLY', 1299, 'EUR', false, 1000),
  (:spotify, :gastos, :subs, 'shopping', 'Spotify', 'pending', :ana, pg_temp.day(0), true,
   'FREQ=MONTHLY', 1099, 'EUR', false, 2000),
  (:seguro, :gastos, :subs, 'shopping', 'Seguro del coche', 'pending', :ana, pg_temp.day(100), true,
   'FREQ=YEARLY', 24000, 'EUR', false, 3000),
  (:disney, :gastos, :subs, 'shopping', 'Disney+', 'pending', :ana, pg_temp.day(5), true,
   'FREQ=MONTHLY', 899, 'EUR', true, 4000),
  (:hbo, :gastos, :subs, 'shopping', 'HBO Max', 'discarded', :ana, pg_temp.day(-40), true,
   'FREQ=MONTHLY', 999, 'EUR', false, 5000),
  (:luz, :gastos, null, 'shopping', 'Luz', 'pending', :ana, pg_temp.day(-3), true,
   'FREQ=MONTHLY', 6430, 'EUR', false, 2000),
  (:multa, :gastos, null, 'shopping', 'Multa', 'pending', :ana, pg_temp.day(15), true,
   null, 6000, 'EUR', false, 3000),
  (:cascos, :gastos, null, 'shopping', 'Auriculares', 'pending', :ana, null, false,
   null, 27900, 'EUR', false, 4000);

-- ─── La prueba solo vale en un pago que se repite ────────────────────────────────────────────

update public.items set trial = true where id in (:multa, :cascos);
select is_empty(format('select 1 from public.items where id in (%L, %L) and trial', :multa, :cascos),
  'sin repetir o sin fecha no es prueba');
update public.items set trial = true where id = :netflix;
update public.items set recurrence = null where id = :netflix;
select results_eq(format('select trial from public.items where id = %L', :netflix),
  $$values (false)$$, 'al dejar de repetirse, deja de ser prueba');
update public.items set recurrence = 'FREQ=MONTHLY' where id = :netflix;

-- ─── Los totales ─────────────────────────────────────────────────────────────────────────────

-- Al año: Netflix 12 × 12,99, Spotify 12 × 10,99, el seguro 240 y la luz 12 × 64,30; ni la prueba
-- (Disney+, que cobra dentro de 5 días), ni la de baja (HBO), ni lo de una vez.
select results_eq(
  format($$select payment_count, trial_count, yearly_cents, once_cents, pending_price_cents
           from public.list_counters where list_id = %L$$, :gastos),
  $$values (6, 1, 129936, 33900, 67627)$$,
  '6 pagos, 1 en prueba, 1299,36 € al año, 339 € de una vez y el total de siempre');

-- La prueba cuenta desde su día: el de hoy ya no es prueba.
update public.items set due_at = pg_temp.day(0) where id = :disney;
select results_eq(
  format('select trial_count, yearly_cents from public.list_counters where list_id = %L', :gastos),
  $$values (0, 140724)$$, 'el día que empieza a cobrar, la prueba ya cuenta');
update public.items set due_at = pg_temp.day(5) where id = :disney;

-- Sin pagos que se repitan, `yearly_cents` es `null` (la cabecera dice «Total»).
update public.items set recurrence = null where id in (:netflix, :spotify, :seguro, :disney, :luz);
select results_eq(
  format('select yearly_cents, payment_count from public.list_counters where list_id = %L', :gastos),
  $$values (null::integer, 6)$$, 'sin nada que se repita, sin total al año');
update public.items set recurrence = 'FREQ=MONTHLY' where id in (:netflix, :spotify, :disney, :luz);
update public.items set recurrence = 'FREQ=YEARLY' where id = :seguro;
update public.items set trial = true where id = :disney;

-- ─── Pagar ───────────────────────────────────────────────────────────────────────────────────

-- Bea paga Netflix antes de tiempo: pasa al cobro siguiente al que tenía, con lo pagado.
:as_bea
update public.items set status = 'bought' where id = :netflix;
:as_admin
select results_eq(
  format($$select status, completed_at is null,
                  (due_at at time zone 'Europe/Madrid')::date
                    = ((pg_temp.day(18) at time zone 'Europe/Madrid') + interval '1 month')::date
           from public.items where id = %L$$, :netflix),
  $$values ('pending', true, true)$$,
  'Netflix sigue pendiente, un mes después de la fecha que tenía');
select results_eq(
  format($$select done_by, price_cents, currency, pg_temp.days_from_today(occurrence), trial
           from public.item_completions where item_id = %L$$, :netflix),
  format('values (%L::uuid, 1299, %L, 18, false)', :bea, 'EUR'),
  'queda la vez pagada, por Bea, con 12,99 € y la fecha que tenía');

-- La luz atrasada: al siguiente cobro desde su fecha, no antes de mañana.
update public.items set status = 'bought' where id = :luz;
select results_eq(
  format($$select (due_at at time zone 'Europe/Madrid')::date
                    = ((pg_temp.day(-3) at time zone 'Europe/Madrid') + interval '1 month')::date
           from public.items where id = %L$$, :luz),
  $$values (true)$$, 'la luz atrasada salta a su fecha del mes que viene');

-- La prueba: pagarla la deja en un pago más; deshacerlo la devuelve a prueba.
:as_ana
update public.items set status = 'bought' where id = :disney;
:as_admin
select results_eq(format('select trial, status from public.items where id = %L', :disney),
  $$values (false, 'pending')$$, 'pagada la prueba, deja de serlo');
select results_eq(format('select trial, price_cents from public.item_completions where item_id = %L', :disney),
  $$values (true, 899)$$, 'la vez pagada recuerda que era la prueba');
:as_ana
select public.undo_repeat(:disney);
:as_admin
select results_eq(
  format('select trial, pg_temp.days_from_today(due_at) from public.items where id = %L', :disney),
  $$values (true, 5)$$, 'deshacer la devuelve a prueba y a su fecha');

-- Lo de una vez se paga como una compra: a «Fuera de la cabeza», sin vez apuntada.
update public.items set status = 'bought' where id = :multa;
select results_eq(format('select status, completed_at is not null from public.items where id = %L', :multa),
  $$values ('bought', true)$$, 'la multa, pagada, se queda pagada');
select is_empty(format('select 1 from public.item_completions where item_id = %L', :multa),
  'y no deja vez apuntada');

-- Darse de baja (descartar) no apunta nada y sale del total.
update public.items set status = 'discarded' where id = :spotify;
select is_empty(format('select 1 from public.item_completions where item_id = %L', :spotify),
  'darse de baja no apunta un pago');
select results_eq(
  format('select payment_count, yearly_cents from public.list_counters where list_id = %L', :gastos),
  $$values (4, 116748)$$, 'y Spotify deja de contar: Netflix, el seguro y la luz, 1167,48 € al año');

-- Una tarea que se repite sigue como en la 3.6, sin importe.
:as_ana
insert into public.items (list_id, kind, title, status, created_by, due_at, all_day, recurrence,
                          position)
values (:gastos, 'task', 'Revisar la cuenta', 'pending', :ana, pg_temp.day(0), true, 'FREQ=WEEKLY',
        9000);
update public.items set status = 'done' where title = 'Revisar la cuenta';
:as_admin
select results_eq(
  $$select c.price_cents, pg_temp.days_from_today(i.due_at)
    from public.item_completions c join public.items i on i.id = c.item_id
    where i.title = 'Revisar la cuenta'$$,
  $$values (null::integer, 7)$$, 'una tarea que se repite sigue igual, sin importe');

-- ─── Los avisos de un pago ───────────────────────────────────────────────────────────────────

:as_ana
insert into public.reminders (item_id, user_id, remind_at, offset_minutes)
values (:disney, :ana, now(), 2 * 1440 - 540);
:as_admin
select results_eq(
  format($$select pg_temp.days_from_today(r.remind_at)
           from public.reminders r where r.item_id = %L$$, :disney),
  $$values (3)$$, 'una compra lleva aviso: «2 días antes · 9:00» de una prueba que cobra en 5 días');

-- El que vence lo reclama el envío, con el precio y si es prueba (uno a una hora fija, que el
-- relativo lo recalcula la base).
update public.reminders set offset_minutes = null, remind_at = now() - interval '1 minute'
where item_id = :disney;
select results_eq(
  format($$select kind, price_cents, currency, recurring, trial
           from public.claim_due_reminders() where item_id = %L$$, :disney),
  $$values ('shopping', 899, 'EUR', true, true)$$,
  'el envío sabe que es una prueba de 8,99 € que se repite');

-- Si deja de ser compra, el aviso se va, como el de una tarea que pasa a nota.
update public.items set kind = 'note', status = 'pending' where id = :disney;
select is_empty(format('select 1 from public.reminders where item_id = %L', :disney),
  'al dejar de ser compra, su aviso se quita');

select * from finish(true);
rollback;
