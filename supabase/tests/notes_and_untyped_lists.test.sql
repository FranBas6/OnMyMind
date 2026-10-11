-- Sesión 5.3 · La nota como tipo base y las listas sin tipo (ADR-012): una nota no se marca hecha
-- ni cuenta como pendiente; mover nunca cambia el tipo; las listas nuevas no tienen tipo, se ven
-- como lista o como agenda y dicen cuántas cosas tienen de cada tipo. Ana tiene «En mente» y
-- «Casa»; Carlos no tiene nada que ver. En una transacción que se deshace al final.
-- `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana    '''00000000-0000-4000-a530-00000000000a'''
\set carlos '''00000000-0000-4000-a530-00000000000c'''
\set casa   '''00000000-0000-4000-a530-0000000000a1'''
\set agenda '''00000000-0000-4000-a530-0000000000a2'''
\set wifi   '''00000000-0000-4000-a530-0000000000b1'''
\set grifo  '''00000000-0000-4000-a530-0000000000b2'''
\set leche  '''00000000-0000-4000-a530-0000000000b3'''
\set cena   '''00000000-0000-4000-a530-0000000000b4'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{}', jsonb_build_object('full_name', name), now(), now()
from (values (:ana, 'ana-53@example.com', 'Ana'),
             (:carlos, 'carlos-53@example.com', 'Carlos')) as u(id, email, name);

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a530-00000000000a''); set local role authenticated;'
\set as_carlos 'reset role; select pg_temp.claims(''00000000-0000-4000-a530-00000000000c''); set local role authenticated;'

-- ─── Una cuenta nueva, con listas sin tipo ───────────────────────────────────────────────────

select results_eq(
  format('select name, kind::text, view from public.lists where owner_id = %L order by position',
         :ana),
  $$values ('En mente'::text, 'inbox'::text, 'list'::text), ('Casa', 'list', 'list'),
           ('Compras', 'list', 'list'), ('Agenda', 'list', 'agenda')$$,
  'una cuenta nueva empieza con «En mente» y tres listas sin tipo; «Agenda» se ve por días');

:as_ana
insert into public.lists (id, owner_id, name, color, position)
values (:casa, :ana, 'Casa de la playa', 'coral', 5000);
select results_eq(format('select kind::text, view from public.lists where id = %L', :casa),
  $$values ('list'::text, 'list'::text)$$,
  'una lista nueva no tiene tipo y se ve como lista');
select results_eq(
  format('select view from public.my_lists where id = %L', :casa),
  $$values ('list'::text)$$,
  'my_lists dice cómo se ve');

select throws_ok(format('update public.lists set view = %L where id = %L', 'calendario', :casa),
  '23514', null, 'la vista es lista o agenda');

-- ─── La nota no tiene estado ─────────────────────────────────────────────────────────────────

insert into public.items (id, list_id, created_by, kind, title, status, position)
values (:wifi, (select id from public.lists where owner_id = :ana and kind = 'inbox'), :ana,
        'note', 'La clave del wifi', 'pending', 1000);
select throws_like(format('update public.items set status = %L where id = %L', 'done', :wifi),
  '%no válido%', 'una nota no se marca hecha');

-- ─── Mover nunca cambia el tipo ──────────────────────────────────────────────────────────────

update public.items set list_id = :casa where id = :wifi;
select results_eq(format('select kind::text, status from public.items where id = %L', :wifi),
  $$values ('note'::text, 'pending'::text)$$,
  'una nota movida a «Casa de la playa» sigue siendo nota');

insert into public.items (id, list_id, created_by, kind, title, status, position, due_at)
values (:grifo, :casa, :ana, 'task', 'Arreglar el grifo', 'in_progress', 2000, now() + interval '2 days');
update public.items set list_id = (select id from public.lists where owner_id = :ana and kind = 'inbox')
where id = :grifo;
select results_eq(format('select kind::text, status, due_at is not null from public.items where id = %L',
                         :grifo),
  $$values ('task'::text, 'in_progress'::text, true)$$,
  'una tarea movida a «En mente» sigue siendo tarea, en curso y con su fecha');
update public.items set list_id = :casa where id = :grifo;

-- ─── Contadores ──────────────────────────────────────────────────────────────────────────────

insert into public.items (id, list_id, created_by, kind, title, status, position, price_cents)
values (:leche, :casa, :ana, 'shopping', 'Leche', 'pending', 3000, 249);
insert into public.items (id, list_id, created_by, kind, title, status, position)
values (:cena, :casa, :ana, 'task', 'Cena con Bea', 'done', 4000);

create function pg_temp.counters(list uuid)
returns table (p integer, d integer, n integer, nt integer, tt integer, st integer, et integer)
language sql as $$
  select pending_count, done_count, notes_count, note_total, task_total, shopping_total,
         event_total
  from public.list_counters where list_id = list
$$;
select results_eq(format('select * from pg_temp.counters(%L)', :casa),
  $$values (2, 1, 1, 1, 2, 1, 0)$$,
  'la nota no cuenta como pendiente: va aparte, y se sabe cuántas hay de cada tipo');

:as_carlos
select is_empty(format('select 1 from public.list_counters where list_id = %L', :casa),
  'Carlos no ve los contadores de Ana');

-- ─── Duplicar conserva la vista ──────────────────────────────────────────────────────────────

:as_ana
insert into public.lists (id, owner_id, name, color, view, position)
values (:agenda, :ana, 'Viaje a Roma', 'teal', 'agenda', 6000);
select public.duplicate_list(:agenda, 'Viaje a Roma (copia)');
select results_eq(
  $$select kind::text, view from public.lists where name = 'Viaje a Roma (copia)'$$,
  $$values ('list'::text, 'agenda'::text)$$,
  'la copia se ve igual que la original');

select * from finish(true);
rollback;
