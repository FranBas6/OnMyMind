-- Sesión 3.4 · En directo (plan 03-fase-3; diseño 20, M7, M8 y M12).
--
-- Si dos personas tienen la misma lista abierta, lo que hace una aparece en la otra al momento.
-- Cada cambio en una lista se avisa a quienes la ven por Realtime, con Broadcast desde la base: los
-- triggers mandan un mensaje al canal privado de cada persona (`user:<id>`), que solo puede escuchar
-- ella. El mensaje dice qué lista cambió, no cómo: la app vuelve a pedir lo que tenga en pantalla.
--
-- Por qué no Postgres Changes (añadir las tablas a la publicación `supabase_realtime`), como decía
-- el plan: ahí los borrados no pasan por RLS, porque la fila ya no está para comprobarla, y cada
-- `delete` de un ítem llegaría a todas las cuentas conectadas. Tampoco llegaría nada a quien quitan
-- de una lista, que ya no la puede leer. Con Broadcast, el trigger elige a quién avisa.
--
-- `realtime.send` no falla nunca: si Realtime no puede, deja un aviso en el log y la escritura
-- sigue. Los mensajes se guardan en `realtime.messages`, que Supabase vacía solo.

-- ─── A quién se avisa ────────────────────────────────────────────────────────────────────────

-- Quién hizo el cambio: la persona (`by`, nula si fue la base o una función) y su sesión
-- (`session`, una por dispositivo en que entró). Lo suyo también le llega, porque puede tener la
-- lista abierta en otro dispositivo; con la sesión, el dispositivo que lo hizo sabe que era suyo.
create or replace function public.change_author()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('by', (select auth.uid()),
                            'session', (select auth.jwt() ->> 'session_id'))
$$;

-- Quienes ven una lista (quien la creó y quienes entraron) reciben `p_payload` con la lista y
-- quién hizo el cambio.
create or replace function public.broadcast_list(p_list_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    p_payload || jsonb_build_object('list_id', p_list_id) || public.change_author(),
    'change', 'user:' || audience.user_id, true)
  from (
    select l.owner_id as user_id from public.lists l where l.id = p_list_id
    union
    select m.user_id from public.list_members m
    where m.list_id = p_list_id and m.accepted_at is not null
  ) audience;
end $$;

-- A una sola persona (quien sale de una lista ya no está entre quienes la ven).
create or replace function public.broadcast_user(p_user_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload || public.change_author(), 'change', 'user:' || p_user_id, true);
end $$;

-- ─── Ítems ───────────────────────────────────────────────────────────────────────────────────

-- Un mensaje por lista y sentencia, no por fila: reordenar veinte cosas manda uno. Lleva qué entró
-- (`added`) y qué se terminó (`completed`), para que la fila del otro se note (M7 y M8). Mover un
-- ítem a otra lista avisa a las dos. Al borrar una lista, sus ítems se van con ella y aquí ya no
-- queda a quién avisar: lo dice el trigger de la lista.
create or replace function public.items_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  touched record;
begin
  if tg_op = 'INSERT' then
    for touched in
      select n.list_id, jsonb_agg(n.id) as added from new_rows n group by n.list_id
    loop
      perform public.broadcast_list(touched.list_id, jsonb_build_object(
        'kind', 'items', 'added', touched.added, 'completed', '[]'::jsonb));
    end loop;
  elsif tg_op = 'UPDATE' then
    for touched in
      select t.list_id,
             coalesce(jsonb_agg(t.id) filter (where t.completed), '[]'::jsonb) as completed
      from (
        select n.list_id, n.id, o.completed_at is null and n.completed_at is not null as completed
        from new_rows n join old_rows o on o.id = n.id
        union all
        select o.list_id, o.id, false
        from new_rows n join old_rows o on o.id = n.id
        where o.list_id <> n.list_id
      ) t
      group by t.list_id
    loop
      perform public.broadcast_list(touched.list_id, jsonb_build_object(
        'kind', 'items', 'added', '[]'::jsonb, 'completed', touched.completed));
    end loop;
  else
    for touched in select distinct o.list_id from old_rows o
    loop
      perform public.broadcast_list(touched.list_id, jsonb_build_object(
        'kind', 'items', 'added', '[]'::jsonb, 'completed', '[]'::jsonb));
    end loop;
  end if;
  return null;
end $$;

-- Con tablas de transición, un trigger por operación.
create trigger items_broadcast_insert after insert on public.items
  referencing new table as new_rows
  for each statement execute function public.items_broadcast();
create trigger items_broadcast_update after update on public.items
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.items_broadcast();
create trigger items_broadcast_delete after delete on public.items
  referencing old table as old_rows
  for each statement execute function public.items_broadcast();

-- ─── Listas ──────────────────────────────────────────────────────────────────────────────────

-- Cambia el nombre, el color, se archiva o se borra: lo ven todos. Al borrar, antes, que es cuando
-- aún se sabe quién estaba (quien entró recibe además el porqué, de `list_departures`).
create or replace function public.lists_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.broadcast_list(coalesce(new.id, old.id), jsonb_build_object('kind', 'list'));
  return coalesce(new, old);
end $$;

create trigger lists_broadcast after insert or update on public.lists
  for each row execute function public.lists_broadcast();
create trigger lists_broadcast_delete before delete on public.lists
  for each row execute function public.lists_broadcast();

-- ─── Quién está ──────────────────────────────────────────────────────────────────────────────

-- Alguien entra o sale: cambian las iniciales de todos. Quien sale lo recibe aparte, porque ya no
-- está entre quienes la ven (si lo quitaron, además, el porqué). Su orden en Inicio
-- (`position`), solo a esa persona: sus otros dispositivos.
create or replace function public.members_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.accepted_at is not distinct from new.accepted_at then
    perform public.broadcast_user(new.user_id,
      jsonb_build_object('kind', 'list', 'list_id', new.list_id));
    return null;
  end if;
  perform public.broadcast_list(coalesce(new.list_id, old.list_id),
    jsonb_build_object('kind', 'people'));
  if tg_op = 'DELETE' then
    perform public.broadcast_user(old.user_id,
      jsonb_build_object('kind', 'people', 'list_id', old.list_id));
  end if;
  return null;
end $$;

create trigger members_broadcast after insert or delete or update of accepted_at, position
  on public.list_members
  for each row execute function public.members_broadcast();

-- Te quitan, o quien la creó la borra o la archiva (3.3): a ti, con el porqué (M9 y M10).
create or replace function public.departures_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.broadcast_user(new.user_id, jsonb_build_object(
    'kind', 'departure', 'list_id', new.list_id, 'reason', new.reason));
  return null;
end $$;

create trigger departures_broadcast after insert or update on public.list_departures
  for each row execute function public.departures_broadcast();

-- ─── Quién escucha qué ───────────────────────────────────────────────────────────────────────

-- Cada uno, solo su canal. Sin política de `insert`: desde la app no se manda nada a nadie.
create policy live_lists_receive on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- ─── Permisos de las funciones ───────────────────────────────────────────────────────────────

revoke execute on function public.change_author() from public, anon, authenticated;
revoke execute on function public.broadcast_list(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.broadcast_user(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.items_broadcast() from public, anon, authenticated;
revoke execute on function public.lists_broadcast() from public, anon, authenticated;
revoke execute on function public.members_broadcast() from public, anon, authenticated;
revoke execute on function public.departures_broadcast() from public, anon, authenticated;
