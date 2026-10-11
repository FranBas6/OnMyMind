-- Sesión 5.1 · Elegir una (idea 1 de la fase 5, diseño 24). Una sublista «para elegir una» tiene
-- opciones entre las que se elige una sola: «Volantes» con el G29 y el G923.
--   · `items.choose_one`: la sublista es «para elegir una». Solo en sublistas.
--   · `items.chosen_id`: la opción elegida, la preferida (Fran, 2026-10-11). Elegirla no la compra
--     ni la termina, y no cierra la sublista: eso va como siempre, con su estado. Se olvida al dejar
--     de «elegir una», y también si la elegida se borra o sale de la sublista.
--   · `list_counters`: mientras la sublista está activa, sus opciones pendientes cuentan como una
--     sola cosa pendiente («4 pendientes» en Compras con Volantes y tres más), y en el total suma
--     la elegida si sigue pendiente o, si no, la compra pendiente más barata (en euros: es lo que
--     suma el total).
--   · `duplicate_list` copia `choose_one`, sin la elegida.
-- Referencia: docs/concept/03-modelo-de-datos.md §items y docs/plans/05-fase-5.md (5.1).

-- ─── Columnas ────────────────────────────────────────────────────────────────────────────────

alter table public.items
  add column choose_one boolean not null default false,
  add column chosen_id uuid references public.items (id) on delete set null,
  add constraint items_choose_one_sublist check (not choose_one or kind = 'sublist');

comment on column public.items.choose_one is
  'Sublista «para elegir una» (5.1): sus opciones cuentan como una y suma la elegida o la más barata.';
comment on column public.items.chosen_id is
  'La opción elegida (la preferida) de una sublista «para elegir una» (5.1). No cambia su estado.';

-- La elegida solo vive en una sublista «para elegir una»: dejar de elegir una la olvida.
create or replace function public.items_choice_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.choose_one then
    new.chosen_id := null;
  end if;
  return new;
end $$;

create trigger items_choice_before before insert or update on public.items
  for each row execute function public.items_choice_before();

-- La elegida es de dentro de la sublista. Se comprueba al final de la transacción: al restaurar una
-- sublista borrada («Deshacer»), la sublista entra antes que lo de dentro.
create or replace function public.items_chosen_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.items s
    where s.id = new.id and s.chosen_id is not null
      and not exists (select 1 from public.items c where c.id = s.chosen_id and c.parent_id = s.id)
  ) then
    raise exception 'La elegida tiene que ser de dentro de la sublista' using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger items_chosen_check
  after insert or update of chosen_id on public.items
  deferrable initially deferred
  for each row when (new.chosen_id is not null)
  execute function public.items_chosen_check();

-- La elegida sale de la sublista (a otra sublista o suelta): la sublista la olvida.
create or replace function public.items_leave_choice()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.items set chosen_id = null where id = old.parent_id and chosen_id = old.id;
  return null;
end $$;

create trigger items_leave_choice after update of parent_id on public.items
  for each row when (old.parent_id is not null and old.parent_id is distinct from new.parent_id)
  execute function public.items_leave_choice();

-- ─── Contadores ──────────────────────────────────────────────────────────────────────────────
-- Como en `events_past_by_day` (2.4), con las opciones de una sublista «para elegir una» activa:
-- las pendientes cuentan una vez por sublista, y en el total suma la elegida mientras siga
-- pendiente (su precio en euros, o nada si no lo tiene) o, si no, la compra pendiente más barata.
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null and not coalesce(p.choose_one, false)
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
    as pending_price_cents
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
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;

-- ─── Duplicar: «para elegir una», sin la elección ────────────────────────────────────────────
-- Igual que en la 4.5 (`item_images`), con `choose_one`. `chosen_id` no se copia: la copia
-- empieza sin elegir.
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

  insert into public.lists (id, owner_id, name, color, icon, kind, field_schema, position)
  values (copy_id, uid, v_name, source.color, source.icon, source.kind, source.field_schema,
          next_position);

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

revoke execute on function public.items_choice_before() from public, anon, authenticated;
revoke execute on function public.items_chosen_check() from public, anon, authenticated;
revoke execute on function public.items_leave_choice() from public, anon, authenticated;
revoke execute on function public.duplicate_list(uuid, text) from public, anon;
grant execute on function public.duplicate_list(uuid, text) to authenticated;
