-- Sesión 5.8 · Listas ocultas (ADR-013, diseño 27).
--   · Ocultar es de cada uno: `hidden_lists` guarda quién ha ocultado qué lista. En una compartida,
--     los demás la siguen viendo como siempre. No se cifra nada: protege de quien coge el móvil,
--     no de quien lee la base (ADR-013), así que la lista sigue funcionando entera.
--   · Las consultas de siempre la dejan fuera para quien la ocultó, y no se descarga:
--       - `my_lists` gana `hidden`, y la app pide aparte las ocultas solo al desbloquear;
--       - `items.in_hidden_list` (una columna calculada de PostgREST) para Hoy, Buscar y lo demás
--         que mira todas las listas;
--       - el resumen de Hoy, el Calendario y «Bajaron esta mañana» no las cuentan.
--   · Sus avisos y sus bajadas de precio llegan sin título («Tienes un aviso en una lista oculta»):
--     `claim_due_reminders` y `record_price_check` dicen para quién está oculta.
--   · Al ocultar la lista por defecto de la captura, la captura vuelve a «En mente». Duplicar una
--     oculta deja la copia oculta.
-- Referencia: docs/concept/decisiones/ADR-013-que-protege-lo-privado.md y docs/plans/05-fase-5.md
-- (5.8).

-- ─── Quién oculta qué ────────────────────────────────────────────────────────────────────────

create table public.hidden_lists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

comment on table public.hidden_lists is
  'Las listas que cada persona ha ocultado (5.8, ADR-013): solo para ella, sin cifrar nada.';

create index hidden_lists_list_idx on public.hidden_lists (list_id);

alter table public.hidden_lists enable row level security;

-- Cada uno las suyas, de listas que ve. «En mente» no se oculta. Mostrar es borrar la fila.
create policy hidden_lists_select on public.hidden_lists for select to authenticated
  using (user_id = (select auth.uid()));
create policy hidden_lists_insert on public.hidden_lists for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_list_member(list_id)
    and not exists (select 1 from public.lists l where l.id = list_id and l.kind = 'inbox'));
create policy hidden_lists_delete on public.hidden_lists for delete to authenticated
  using (user_id = (select auth.uid()));

-- Si la lista está oculta para quien pregunta.
create function public.is_hidden_list(p_list_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.hidden_lists h
    where h.user_id = (select auth.uid()) and h.list_id = p_list_id)
$$;

revoke execute on function public.is_hidden_list(uuid) from public, anon;
grant execute on function public.is_hidden_list(uuid) to authenticated;

-- Columna calculada de PostgREST (`items?in_hidden_list=is.false`): si el ítem está en una lista
-- que quien pregunta ha ocultado. Hoy, Buscar, las sublistas de la captura y lo movido de «En
-- mente» filtran con ella, así que lo de una oculta no se descarga.
create function public.in_hidden_list(public.items)
returns boolean language sql stable set search_path = '' as $$
  select public.is_hidden_list($1.list_id)
$$;

revoke execute on function public.in_hidden_list(public.items) from public, anon;
grant execute on function public.in_hidden_list(public.items) to authenticated;

-- Al ocultar la lista por defecto de la captura, la captura vuelve a «En mente» (D1c).
create function public.hidden_lists_after_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.profiles p
  set settings = jsonb_set(
        p.settings, '{default_list_id}',
        to_jsonb((select l.id from public.lists l
                  where l.owner_id = new.user_id and l.kind = 'inbox')))
  where p.id = new.user_id
    and p.settings ->> 'default_list_id' = new.list_id::text;
  return null;
end
$$;

create trigger hidden_lists_after_insert
  after insert on public.hidden_lists
  for each row execute function public.hidden_lists_after_insert();

-- Tus otros aparatos se enteran al momento (en directo, 3.4): la lista sale o vuelve a Inicio, y
-- Hoy y Buscar se vuelven a pedir. Solo a ti: para los demás no cambia nada.
create function public.hidden_lists_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.broadcast_user(coalesce(new.user_id, old.user_id), jsonb_build_object(
    'kind', 'hidden', 'list_id', coalesce(new.list_id, old.list_id)));
  return null;
end
$$;

revoke execute on function public.hidden_lists_broadcast() from public, anon, authenticated;

create trigger hidden_lists_broadcast
  after insert or delete on public.hidden_lists
  for each row execute function public.hidden_lists_broadcast();

-- Quien sale de una lista compartida (o a quien quitan) deja de tenerla oculta: si vuelve a entrar,
-- la ve como cualquier otra.
create function public.members_forget_hidden()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.hidden_lists h where h.user_id = old.user_id and h.list_id = old.list_id;
  return null;
end
$$;

revoke execute on function public.members_forget_hidden() from public, anon, authenticated;

create trigger members_forget_hidden
  after delete on public.list_members
  for each row execute function public.members_forget_hidden();

-- ─── Tus listas, con las ocultas aparte ──────────────────────────────────────────────────────
-- Como en `notes_and_untyped_lists` (5.3), con `hidden` al final.
create or replace view public.my_lists with (security_invoker = true) as
select
  l.id, l.name, l.color, l.icon, l.kind, l.archived_at, l.owner_id,
  coalesce(m.position, l.position) as position,
  l.owner_id = (select auth.uid()) as is_owner,
  l.view,
  exists (
    select 1 from public.hidden_lists h
    where h.list_id = l.id and h.user_id = (select auth.uid())) as hidden
from public.lists l
left join public.list_members m
  on m.list_id = l.id and m.user_id = (select auth.uid()) and m.accepted_at is not null
where l.owner_id = (select auth.uid())
   or (m.user_id is not null and l.archived_at is null);

-- ─── Duplicar una oculta: la copia, también oculta ───────────────────────────────────────────
-- Como en `protected_notes` (5.7), con la copia oculta si la de origen lo está para quien duplica:
-- si no, «Regalos de Marta (copia)» saldría en Inicio.
create or replace function public.duplicate_list(p_list_id uuid, p_name text)
returns jsonb language plpgsql set search_path = '' as $$
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

  if public.is_hidden_list(p_list_id) then
    insert into public.hidden_lists (user_id, list_id) values (uid, copy_id);
  end if;

  select coalesce(jsonb_object_agg(i.id, gen_random_uuid()), '{}') into ids
  from public.items i where i.list_id = p_list_id;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed, choose_one, protected, sealed_notes, sealed_iv, sealed_key_id)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, null, i.title, i.notes,
         (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed, i.choose_one, i.protected, i.sealed_notes, i.sealed_iv, i.sealed_key_id
  from public.items i
  cross join lateral (select exists (select 1 from public.item_links k where k.item_id = i.id)
                      as has_links) l
  where i.list_id = p_list_id and i.parent_id is null
  order by i.position;

  insert into public.items (
    id, list_id, created_by, kind, parent_id, title, notes, status, fields, position, recurrence,
    url, url_title, url_site, image_url, price_cents, currency, price_source, price_checked_at,
    price_followed, protected, sealed_notes, sealed_iv, sealed_key_id)
  select (ids ->> i.id::text)::uuid, copy_id, uid, i.kind, (ids ->> i.parent_id::text)::uuid,
         i.title, i.notes, (public.item_statuses(i.kind))[1], i.fields, i.position, i.recurrence,
         i.url, i.url_title, i.url_site, i.image_url,
         case when has_links then null else i.price_cents end, i.currency,
         case when has_links then null else i.price_source end,
         case when has_links then null else i.price_checked_at end,
         i.price_followed, i.protected, i.sealed_notes, i.sealed_iv, i.sealed_key_id
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

revoke execute on function public.duplicate_list(uuid, text) from public, anon;
grant execute on function public.duplicate_list(uuid, text) to authenticated;

-- ─── Los avisos, sin título ──────────────────────────────────────────────────────────────────
-- Como en `send_reminders_cron` (2.7), con `concealed` al final: la lista está oculta para quien
-- recibe el aviso. `send-reminders` lo envía sin título ni lista.
drop function public.claim_due_reminders(integer);

create function public.claim_due_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid, user_id uuid, item_id uuid, list_id uuid, title text, kind text,
  all_day boolean, list_name text, remind_at timestamptz, occurs_at timestamptz,
  occurs_local text, now_local text, done boolean, hidden boolean, concealed boolean)
language sql set search_path = '' as $$
  with due as (
    select r.id
    from public.reminders r
    where r.sent_at is null and r.remind_at <= now()
    order by r.remind_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.reminders r
    set sent_at = now(), remind_at = r.remind_at
    from due
    where r.id = due.id
    returning r.id
  )
  select
    r.id, r.user_id, i.id, i.list_id, i.title, i.kind::text, i.all_day, l.name, r.remind_at,
    o.occurs_at,
    to_char(o.occurs_at at time zone z.tz, 'YYYY-MM-DD"T"HH24:MI'),
    to_char(now() at time zone z.tz, 'YYYY-MM-DD"T"HH24:MI'),
    i.completed_at is not null,
    l.archived_at is not null
      or (i.parent_id is not null and not public.is_active_sublist_status(p.status)),
    exists (select 1 from public.hidden_lists h
            where h.user_id = r.user_id and h.list_id = i.list_id)
  from claimed c
  join public.reminders r on r.id = c.id
  join public.items i on i.id = r.item_id
  join public.lists l on l.id = i.list_id
  left join public.items p on p.id = i.parent_id
  cross join lateral (select public.user_timezone(r.user_id) as tz) z
  cross join lateral (
    select case
      -- Uno relativo: el momento del ítem es el aviso más su desfase, en la hora del reloj.
      when r.offset_minutes is not null then
        ((r.remind_at at time zone z.tz) + make_interval(mins => r.offset_minutes)) at time zone z.tz
      when i.due_at is null then null
      when i.recurrence is null then i.due_at
      -- Uno personalizado en algo que se repite: la vez de ese día o la siguiente.
      else public.reminder_time(i.due_at, i.recurrence, 0, z.tz,
                                date_trunc('day', r.remind_at at time zone z.tz) at time zone z.tz)
    end as occurs_at
  ) o
  order by r.remind_at
$$;

revoke execute on function public.claim_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- ─── El resumen de Hoy, sin las ocultas ──────────────────────────────────────────────────────
-- Como en `send_reminders_cron` (2.7), sin lo de las listas que cada uno ha ocultado.
create or replace function public.claim_daily_summaries()
returns table (user_id uuid, kind text, title text, all_day boolean, occurs_local text,
               overdue boolean)
language sql set search_path = '' as $$
  with due as (
    select p.id, z.tz, now() at time zone z.tz as local_now
    from public.profiles p
    cross join lateral (select public.user_timezone(p.id) as tz) z
    where p.settings ->> 'daily_summary_time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (now() at time zone z.tz)::time - (p.settings ->> 'daily_summary_time')::time
          between interval '0' and interval '15 minutes'
      and (p.summary_sent_on is null or p.summary_sent_on < (now() at time zone z.tz)::date)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    for update of p skip locked
  ),
  claimed as (
    update public.profiles p
    set summary_sent_on = due.local_now::date
    from due
    where p.id = due.id
    returning p.id
  ),
  bounds as (
    select d.id, d.tz,
           date_trunc('day', d.local_now) at time zone d.tz as day_start,
           (date_trunc('day', d.local_now) + interval '1 day') at time zone d.tz as day_end
    from due d
    join claimed c on c.id = d.id
  )
  select b.id, i.kind::text, i.title, i.all_day,
         to_char(o.occurs_at at time zone b.tz, 'YYYY-MM-DD"T"HH24:MI'),
         i.kind = 'task' and i.due_at < b.day_start
  from bounds b
  join public.lists l
    on l.archived_at is null
   and (l.owner_id = b.id
        or exists (select 1 from public.list_members m
                   where m.list_id = l.id and m.user_id = b.id and m.accepted_at is not null))
   and not exists (select 1 from public.hidden_lists h where h.list_id = l.id and h.user_id = b.id)
  join public.items i on i.list_id = l.id
  left join public.items p on p.id = i.parent_id
  cross join lateral (
    select case
      when i.kind = 'event' and i.recurrence is not null then
        public.reminder_time(i.due_at, i.recurrence, 0, b.tz, b.day_start)
      else i.due_at
    end as occurs_at
  ) o
  where i.due_at is not null
    and (i.parent_id is null or public.is_active_sublist_status(p.status))
    and ((i.kind = 'task' and i.completed_at is null and i.due_at < b.day_end)
      or (i.kind = 'event' and i.status = 'upcoming'
          and o.occurs_at >= b.day_start and o.occurs_at < b.day_end))
  order by b.id,
           i.kind = 'event' desc,
           case when i.kind = 'event' then not i.all_day end,
           case when i.kind = 'event' then o.occurs_at end,
           l.position,
           case when i.kind = 'task' then i.due_at end,
           case i.fields ->> 'priority' when 'high' then 0 when 'medium' then 1 when 'low' then 2
             else 3 end,
           i.position
$$;

-- ─── El Calendario, sin las ocultas ──────────────────────────────────────────────────────────
-- Como en `calendar_feed` (3.7), sin los eventos de las listas que ha ocultado quien se suscribe.
create or replace function public.calendar_feed(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with feed as (
    select f.user_id, public.user_timezone(f.user_id) as tz
    from public.calendar_feeds f
    where f.token = p_token
  )
  select jsonb_build_object(
    'timezone', feed.tz,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'list_id', i.list_id,
               'list_name', l.name,
               'title', i.title,
               'notes', i.notes,
               'all_day', i.all_day,
               'start', case
                 when i.all_day then to_char(i.due_at at time zone feed.tz, 'YYYY-MM-DD')
                 else to_char(i.due_at at time zone feed.tz, 'YYYY-MM-DD"T"HH24:MI:SS')
               end,
               'recurrence', public.recurrence_rule(i.recurrence),
               'updated_at', i.updated_at
             ) order by i.due_at, i.id)
      from public.lists l
      join public.items i on i.list_id = l.id
      left join public.items p on p.id = i.parent_id
      where l.archived_at is null
        and (l.owner_id = feed.user_id
             or exists (select 1 from public.list_members m
                        where m.list_id = l.id and m.user_id = feed.user_id
                          and m.accepted_at is not null))
        and not exists (select 1 from public.hidden_lists h
                        where h.list_id = l.id and h.user_id = feed.user_id)
        and i.kind = 'event'
        and i.status = 'upcoming'
        and i.due_at is not null
        and (i.parent_id is null or public.is_active_sublist_status(p.status))
    ), '[]'::jsonb)
  )
  from feed
$$;

-- ─── Las bajadas de precio ───────────────────────────────────────────────────────────────────
-- «Bajaron esta mañana» (3.8), sin las de tus listas ocultas: se ven dentro de la lista.
create or replace function public.my_price_drops()
returns table (item_id uuid, list_id uuid, list_name text, title text, store text,
               image_url text, image_path text, price_cents integer,
               previous_price_cents integer, currency text)
language sql stable set search_path = '' as $$
  with me as (
    select (select auth.uid()) as id,
           date_trunc('day', now() at time zone public.user_timezone((select auth.uid())))
             at time zone public.user_timezone((select auth.uid())) as day_start
  )
  select i.id, i.list_id, l.name, i.title,
         coalesce(i.price_store, public.link_store_name(i.url_site, i.url)),
         i.image_url, i.image_path, i.price_cents, i.previous_price_cents, i.currency
  from me
  join public.price_alerts a on a.user_id = me.id
  join public.items i on i.id = a.item_id
  join public.lists l on l.id = i.list_id
  where i.status = 'pending' and i.price_source = 'auto'
    and i.previous_price_cents > i.price_cents
    and not exists (select 1 from public.hidden_lists h
                    where h.list_id = l.id and h.user_id = me.id)
    and exists (select 1 from public.item_prices p
                where p.item_id = i.id and p.source = 'auto' and p.price_cents = i.price_cents
                  and p.recorded_at >= me.day_start)
  order by l.position, i.position
$$;

-- El aviso de una bajada: como en `price_refresh` (3.8), con `concealed_for` al final, quienes lo
-- reciben y tienen la lista oculta. `refresh-prices` se lo envía sin título.
drop function public.record_price_check(text, uuid, integer, text);

create function public.record_price_check(
  p_target text, p_id uuid, p_price_cents integer, p_currency text default 'EUR')
returns table (item_id uuid, list_id uuid, title text, store text, before_cents integer,
               after_cents integer, currency text, before_checked_at timestamptz,
               recipients uuid[], concealed_for uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  v_item_id uuid;
  v_before public.items;
  v_after public.items;
  v_recipients uuid[];
begin
  if p_target = 'link' then
    select k.item_id into v_item_id from public.item_links k where k.id = p_id;
  elsif p_target = 'item' then
    v_item_id := p_id;
  else
    raise exception 'Destino % no válido', p_target;
  end if;
  select * into v_before from public.items i where i.id = v_item_id;
  if v_before.id is null then
    return;
  end if;

  if p_price_cents is null then
    if p_target = 'link' then
      update public.item_links k
      set price_failures = k.price_failures + 1, price_failed_at = now() where k.id = p_id;
    else
      update public.items i
      set price_failures = i.price_failures + 1, price_failed_at = now() where i.id = p_id;
    end if;
    return;
  end if;

  if p_target = 'link' then
    update public.item_links k
    set price_cents = p_price_cents, currency = p_currency, price_source = 'auto',
        price_checked_at = now()
    where k.id = p_id;
  else
    update public.items i
    set price_cents = p_price_cents, currency = p_currency, price_source = 'auto',
        price_checked_at = now()
    where i.id = p_id;
  end if;

  select * into v_after from public.items i where i.id = v_item_id;
  if v_before.price_cents is null or v_after.price_cents is null
     or v_after.price_cents >= v_before.price_cents
     or v_after.currency is distinct from v_before.currency then
    return;
  end if;

  v_recipients := array(
    select a.user_id
    from public.price_alerts a
    join public.profiles p on p.id = a.user_id
    join public.lists l on l.id = v_after.list_id
    where a.item_id = v_after.id
      and coalesce(p.settings ->> 'price_drop_alerts', 'false') = 'true'
      and (l.owner_id = a.user_id
           or exists (select 1 from public.list_members m
                      where m.list_id = l.id and m.user_id = a.user_id
                        and m.accepted_at is not null))
    order by a.user_id);

  return query
    select v_after.id, v_after.list_id, v_after.title,
           coalesce(v_after.price_store, public.link_store_name(v_after.url_site, v_after.url)),
           v_before.price_cents, v_after.price_cents, v_after.currency, v_before.price_checked_at,
           v_recipients,
           array(
             select h.user_id from public.hidden_lists h
             where h.list_id = v_after.list_id and h.user_id = any (v_recipients)
             order by h.user_id);
end
$$;

revoke execute on function public.record_price_check(text, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_price_check(text, uuid, integer, text) to service_role;
