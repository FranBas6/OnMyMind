-- Sesión 5.9 · Iconos y emojis en las listas: `lists.icon` guarda `lucide:<nombre>` o
-- `emoji:<emoji>` (null = la inicial); la invitación lo enseña y duplicar lo copia. Ana tiene
-- «Casa». En una transacción que se deshace al final. `pnpm db:test`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

\set ana  '''00000000-0000-4000-a590-00000000000a'''
\set casa '''00000000-0000-4000-a590-0000000000a1'''

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values (:ana, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'ana-59@example.com', '{}', '{"full_name": "Ana"}', now(), now());

create function pg_temp.claims(uid uuid) returns text language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;
\set as_ana 'reset role; select pg_temp.claims(''00000000-0000-4000-a590-00000000000a''); set local role authenticated;'

:as_ana
insert into public.lists (id, owner_id, name, color, kind, position)
values (:casa, :ana, 'Casa', 'coral', 'list', 9000);

select lives_ok(format($$update public.lists set icon = 'lucide:house' where id = %L$$, :casa),
  'un icono de lucide');
select lives_ok(format($$update public.lists set icon = 'lucide:graduation-cap' where id = %L$$, :casa),
  'con guiones');
select lives_ok(format($$update public.lists set icon = 'emoji:✈️' where id = %L$$, :casa),
  'un emoji');
select lives_ok(format($$update public.lists set icon = 'emoji:👨‍👩‍👧' where id = %L$$, :casa),
  'un emoji compuesto');
select lives_ok(format($$update public.lists set icon = null where id = %L$$, :casa),
  'y la inicial');
select throws_ok(format($$update public.lists set icon = 'house' where id = %L$$, :casa),
  '23514', null, 'sin decir qué es, no');
select throws_ok(format($$update public.lists set icon = 'lucide:House Big' where id = %L$$, :casa),
  '23514', null, 'un nombre de lucide raro, no');
select throws_ok(format($$update public.lists set icon = 'emoji:' where id = %L$$, :casa),
  '23514', null, 'un emoji vacío, no');
select throws_ok(
  format($$update public.lists set icon = 'emoji:' || repeat('x', 40) where id = %L$$, :casa),
  '23514', null, 'ni un texto largo');

-- La invitación lo enseña.
update public.lists set icon = 'emoji:🎁' where id = :casa;
select invite_token as token from public.create_list_invite(:casa) \gset
reset role;
set local role anon;
select results_eq(format('select list_name, list_icon from public.list_invite_preview(%L)', :'token'),
  $$values ('Casa'::text, 'emoji:🎁'::text)$$, 'la invitación lleva el icono, también sin sesión');
select results_eq($$select list_icon from public.list_invite_preview('desconocido')$$,
  $$values (null::text)$$, 'un enlace que no existe, sin icono');

-- Duplicar lo copia.
:as_ana
select (public.duplicate_list(:casa, 'Casa (copia)') ->> 'list_id') as copy \gset
select results_eq(format('select icon from public.lists where id = %L', :'copy'),
  $$values ('emoji:🎁'::text)$$, 'duplicar copia el icono');

select * from finish(true);
rollback;
