-- Sesión 5.3 · La nota como tipo base y las listas sin tipo (ADR-012, idea 2 de la fase 5).
--   · La nota no tiene estado propio: solo `pending`. No se marca hecha ni cuenta como pendiente
--     (`list_counters` la cuenta aparte, en `notes_count`). Lo que había hecho como nota (lo de
--     «En mente») pasa a tarea hecha; lo pendiente se queda como nota.
--   · Mover nunca cambia el tipo: se quita `items_adopt_kind`.
--   · Las listas no tienen tipo. `lists.kind` solo distingue «En mente» (`inbox`); el valor
--     `custom`, que nunca se usó, pasa a llamarse `list` y es el de las listas nuevas. Los valores
--     viejos (`tasks`, `shopping`, `events`) se quedan en las listas de antes, sin significado.
--     Lo que aún servía se guarda aparte:
--       · la vista, `lists.view` (`list` o `agenda`): las de Eventos, `agenda`;
--       · el tipo que propone la barra de añadir ya no se guarda: sale de lo que hay en la lista,
--         y `list_counters` dice cuántas cosas hay de cada tipo.
-- Referencia: docs/concept/decisiones/ADR-012-la-nota-y-listas-sin-tipo.md, docs/concept/03 y
-- docs/plans/05-fase-5.md (5.3).

-- ─── Listas sin tipo ─────────────────────────────────────────────────────────────────────────

-- `custom` («Personalizada», con sus campos propios) nunca llegó a usarse (ADR-011): su valor pasa
-- a ser el de una lista sin tipo, y su restricción sobra.
alter table public.lists drop constraint lists_custom_needs_schema;
alter type public.list_kind rename value 'custom' to 'list';
alter table public.lists alter column kind set default 'list';

alter table public.lists
  add column view text not null default 'list' check (view in ('list', 'agenda'));

comment on column public.lists.kind is
  '«En mente» (inbox) o una lista sin tipo (list). tasks, shopping y events son de antes de la 5.3.';
comment on column public.lists.view is
  'Cómo se ve la lista: lista o agenda (por días). Las de Eventos de antes, agenda (5.3).';

-- Las de Eventos se siguen viendo como agenda. Sin triggers: no es un cambio de nadie (ni
-- `updated_at` ni avisos en directo).
alter table public.lists disable trigger user;
update public.lists set view = 'agenda' where kind = 'events';
alter table public.lists enable trigger user;

-- ─── La nota, sin estado ─────────────────────────────────────────────────────────────────────

-- Lo hecho que era nota (lo de «En mente») pasa a tarea hecha: así sigue en «Fuera de la cabeza»
-- como estaba. Sin triggers, por lo mismo que arriba: `completed_at` y `completed_by` se quedan.
alter table public.items disable trigger user;
update public.items set kind = 'task' where kind = 'note' and status <> 'pending';
alter table public.items enable trigger user;

-- Estados de cada tipo; el primero es el inicial (el cliente tiene la misma tabla en
-- `features/items/status.ts`). La nota solo tiene uno: se guarda, se edita, se mueve o se borra.
create or replace function public.item_statuses(p_kind public.item_kind)
returns text[] language sql immutable set search_path = '' as $$
  select case p_kind
    when 'note'     then array['pending']
    when 'task'     then array['pending', 'in_progress', 'done']
    when 'shopping' then array['pending', 'bought', 'discarded']
    when 'event'    then array['upcoming', 'cancelled']
    when 'sublist'  then array['pending', 'in_progress', 'paused', 'done']
  end
$$;

-- ─── Mover no cambia el tipo ─────────────────────────────────────────────────────────────────

-- Antes, lo que salía de «En mente» tomaba el tipo de la lista de destino y lo que entraba volvía
-- a ser nota. Ahora el tipo es solo del ítem, y se cambia en su ficha.
drop trigger items_adopt_kind on public.items;
drop function public.items_adopt_kind();

-- ─── Contadores ──────────────────────────────────────────────────────────────────────────────
-- Como en `choose_one` (5.1), y además:
--   · `pending_count` no cuenta las notas, que no son algo por hacer;
--   · `notes_count`, las notas que se ven (las de una sublista pausada o hecha se callan);
--   · `*_total`, cuántas cosas hay de cada tipo en toda la lista, hechas o no y dentro de
--     cualquier sublista: de ahí sale el tipo que propone la barra de añadir.
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null and i.kind <> 'note'
    and not coalesce(p.choose_one, false)
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < d.today))
   + count(distinct i.parent_id) filter (where i.completed_at is null and p.choose_one
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (i.kind = 'event' and i.recurrence is null and i.due_at < d.today)))::integer
    as done_count,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.currency = 'EUR' and not coalesce(p.choose_one, false)), 0)
   + max(o.cents))::integer
    as pending_price_cents,
  (count(i.id) filter (where i.kind = 'note' and not coalesce(p.choose_one, false)))::integer
    as notes_count,
  max(k.notes)::integer as note_total,
  max(k.tasks)::integer as task_total,
  max(k.shopping)::integer as shopping_total,
  max(k.events)::integer as event_total
from public.lists l
cross join (select public.start_of_user_day() as today) d
cross join lateral (
  select coalesce(sum(
    case
      when e.id is not null then
        case when e.kind = 'shopping' and e.currency = 'EUR' then e.price_cents end
      else (
        select min(c.price_cents) from public.items c
        where c.parent_id = s.id and c.kind = 'shopping' and c.completed_at is null
          and c.currency = 'EUR' and c.price_cents is not null
      )
    end), 0) as cents
  from public.items s
  left join public.items e
    on e.id = s.chosen_id and e.parent_id = s.id and e.completed_at is null
  where s.list_id = l.id and s.kind = 'sublist' and s.choose_one
    and public.is_active_sublist_status(s.status)
) o
cross join lateral (
  select
    count(*) filter (where x.kind = 'note') as notes,
    count(*) filter (where x.kind = 'task') as tasks,
    count(*) filter (where x.kind = 'shopping') as shopping,
    count(*) filter (where x.kind = 'event') as events
  from public.items x
  where x.list_id = l.id
) k
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;

-- ─── Las listas de cada uno, con su vista ────────────────────────────────────────────────────
-- Como en `list_sharing` (3.2), con `view` al final.
create or replace view public.my_lists with (security_invoker = true) as
select
  l.id, l.name, l.color, l.icon, l.kind, l.archived_at, l.owner_id,
  coalesce(m.position, l.position) as position,
  l.owner_id = (select auth.uid()) as is_owner,
  l.view
from public.lists l
left join public.list_members m
  on m.list_id = l.id and m.user_id = (select auth.uid()) and m.accepted_at is not null
where l.owner_id = (select auth.uid())
   or (m.user_id is not null and l.archived_at is null);

-- ─── Las listas de una cuenta nueva, sin tipo ────────────────────────────────────────────────
-- Como en el esquema inicial: «En mente» y tres listas para empezar. «Agenda» se ve por días.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inbox_id uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.lists (owner_id, name, color, kind, position)
  values (new.id, 'En mente', 'indigo', 'inbox', 1000)
  returning id into inbox_id;

  insert into public.lists (owner_id, name, color, kind, view, position) values
    (new.id, 'Casa',    'coral', 'list', 'list',   2000),
    (new.id, 'Compras', 'blue',  'list', 'list',   3000),
    (new.id, 'Agenda',  'amber', 'list', 'agenda', 4000);

  update public.profiles
  set settings = jsonb_build_object('default_list_id', inbox_id, 'timezone', 'Europe/Madrid')
  where id = new.id;

  return new;
end $$;

-- ─── Duplicar: con su vista ──────────────────────────────────────────────────────────────────
-- Igual que en `choose_one` (5.1), copiando también `view`.
create or replace function public.duplicate_list(p_list_id uuid, p_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  source public.lists;
  copy_id uuid := gen_random_uuid();
  v_name text := btrim(p_name);
  ids jsonb;
  next_position integer;
  copied integer;
  photos jsonb;
begin
  if uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  select * into source from public.lists where id = p_list_id;
  if source.id is null then
    raise exception 'Lista % no encontrada', p_list_id using errcode = 'P0002';
  end if;
  if source.kind = 'inbox' then
    raise exception 'En mente no se duplica' using errcode = '22023';
  end if;

  select coalesce(greatest(
           (select max(l.position) from public.lists l
            where l.owner_id = uid and l.archived_at is null),
           (select max(m.position) from public.list_members m where m.user_id = uid)
         ), 0) + 1000
    into next_position;

  insert into public.lists (id, owner_id, name, color, icon, kind, view, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.view,
          source.field_schema, next_position);

  select coalesce(jsonb_object_agg(i.id, gen_random_uuid()), '{}') into ids
  from public.items i where i.list_id = p_list_id;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed, choose_one)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, null, i.title, i.notes,
         (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed, i.choose_one
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is null
  order by i.position;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, (ids ->> i.parent_id::text)::uuid,
         i.title, i.notes, (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is not null
  order by i.position;

  insert into public.item_links (item_id, url, url_title, url_site, price_cents, currency,
                                 price_source, price_checked_at, price_followed, position)
  select (ids ->> k.item_id::text)::uuid, k.url, k.url_title, k.url_site, k.price_cents,
         k.currency, k.price_source, k.price_checked_at, k.price_followed, k.position
  from public.item_links k
  join public.items i on i.id = k.item_id
  where i.list_id = p_list_id;

  select count(*) into copied
  from public.items i where i.list_id = copy_id and i.kind <> 'sublist';

  select coalesce(jsonb_agg(jsonb_build_object('item_id', (ids ->> i.id::text)::uuid,
                                               'path', g.path, 'position', g.position)
                            order by i.position, g.position), '[]')
    into photos
  from public.item_images g join public.items i on i.id = g.item_id
  where i.list_id = p_list_id;

  return jsonb_build_object('list_id', copy_id, 'items', copied, 'photos', photos);
end $$;

-- ─── Permisos ────────────────────────────────────────────────────────────────────────────────

revoke execute on function public.duplicate_list(uuid, text) from public, anon;
grant execute on function public.duplicate_list(uuid, text) to authenticated;
