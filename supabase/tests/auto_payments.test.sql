-- Sesión 6.5 · Se cobra solo: lo domiciliado se apunta solo el día del cobro y salta al siguiente;
-- lo que se paga a mano espera. En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana   '''00000000-0000-4000-a650-00000000000a'''
\set subs '''00000000-0000-4000-a650-0000000000c1'''
\set youtube '''00000000-0000-4000-a650-0000000000e1'''
\set spotify '''00000000-0000-4000-a650-0000000000e2'''
\set gym '''00000000-0000-4000-a650-0000000000e3'''
\set disney '''00000000-0000-4000-a650-0000000000e4'''
\set multa '''00000000-0000-4000-a650-0000000000e5'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values (:ana, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'ana-65@example.com', '{}', '{"full_name": "Ana"}', now(), now());

create function pg_temp.day(n integer, months integer default 0) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Europe/Madrid')
          + make_interval(months => months, days => n)) at time zone 'Europe/Madrid'
$$;
create function pg_temp.days_from_today(at timestamptz) returns integer language sql as $$
  select (at at time zone 'Europe/Madrid')::date - (now() at time zone 'Europe/Madrid')::date
$$;

insert into public.lists (id, owner_id, name, color, kind, position)
values (:subs, :ana, 'Subs 65', 'amber', 'list', 9000);

insert into public.items (id, list_id, kind, title, status, created_by, due_at, all_day,
                          recurrence, price_cents, currency, trial, auto_pay, position)
values
  (:youtube, :subs, 'shopping', 'Youtube', 'pending', :ana, pg_temp.day(0), true,
   'FREQ=MONTHLY', 1599, 'EUR', false, true, 1000),
  (:spotify, :subs, 'shopping', 'Spotify', 'pending', :ana, pg_temp.day(-3), true,
   'FREQ=MONTHLY', 1099, 'EUR', false, false, 2000),
  (:gym, :subs, 'shopping', 'Gimnasio', 'pending', :ana, pg_temp.day(-3, -2), true,
   'FREQ=MONTHLY', 3000, 'EUR', false, true, 3000),
  (:disney, :subs, 'shopping', 'Disney+', 'pending', :ana, pg_temp.day(0), true,
   'FREQ=MONTHLY', 899, 'EUR', true, true, 4000),
  (:multa, :subs, 'shopping', 'Multa', 'pending', :ana, pg_temp.day(-1), true,
   null, 6000, 'EUR', false, true, 5000);

select is(
  (select auto_pay from public.items where title = 'Youtube' and list_id = :subs), true,
  'un pago nace cobrándose solo');

select public.charge_auto_payments();
select is(
  (select count(*)::integer from public.item_completions c
   join public.items i on i.id = c.item_id where i.list_id = :subs), 5,
  'cinco cobros: Youtube, Disney+ y tres del gimnasio');

select results_eq(
  format($$select pg_temp.days_from_today(due_at)
                  = (pg_temp.day(0, 1) at time zone 'Europe/Madrid')::date
                    - (now() at time zone 'Europe/Madrid')::date,
                  status, completed_at is null
           from public.items where id = %L$$, :youtube),
  $$values (true, 'pending', true)$$, 'Youtube, cobrado hoy, pasa al mes que viene, pendiente');
select results_eq(
  format($$select pg_temp.days_from_today(done_at), done_by, price_cents, auto
           from public.item_completions where item_id = %L$$, :youtube),
  $$values (0, null::uuid, 1599, true)$$,
  'y queda la vez de hoy, con lo cobrado, apuntada por la base');

select results_eq(
  format($$select count(*)::integer, min(pg_temp.days_from_today(done_at)) < -60
           from public.item_completions where item_id = %L$$, :gym),
  $$values (3, true)$$, 'el gimnasio, dos meses sin cobrarse: tres cobros, cada uno con su fecha');
select ok(
  (select due_at > now() from public.items where id = :gym), 'y queda en el siguiente, que aún no ha llegado');

select results_eq(
  format($$select i.trial, c.trial from public.items i
           join public.item_completions c on c.item_id = i.id where i.id = %L$$, :disney),
  $$values (false, true)$$, 'la prueba que empieza a cobrar hoy se cobra y deja de ser prueba');

select results_eq(
  format('select pg_temp.days_from_today(due_at), status from public.items where id = %L', :spotify),
  $$values (-3, 'pending')$$, 'lo que se paga a mano espera, atrasado');
select is_empty(format('select 1 from public.item_completions where item_id in (%L, %L)', :spotify, :multa),
  'ni lo que se paga a mano ni lo de una vez se apuntan solos');

select public.charge_auto_payments();
select is(
  (select count(*)::integer from public.item_completions c
   join public.items i on i.id = c.item_id where i.list_id = :subs), 5,
  'otra vuelta no apunta nada más');

select throws_ok('set local role authenticated; select public.charge_auto_payments()', '42501', null,
  'nadie desde la app puede cobrar');

select * from finish(true);
rollback;
