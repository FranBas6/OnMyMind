-- Sesión 3.8 · Precios que se miran solos (plan 03-fase-3; ADR-007, capa 3). Cada mañana, desde las
-- 9:00 de Madrid, `pg_cron` llama a la edge function `refresh-prices`, que vuelve a mirar el precio
-- de las compras pendientes cuya tienda lo dio alguna vez. Si cambia, se guarda como `auto` (el
-- trigger de la 2.1 lo apunta en el histórico); si baja, avisa a quien lo pidió para esa compra.
--
-- Decisiones de Fran (2026-10-07): si sube, se guarda sin aviso; lo escrito a mano se sigue mirando
-- y la web lo sustituye; el aviso se pide en cada compra («Avisarme si baja») y además hay un
-- interruptor general en Perfil (`settings.price_drop_alerts`); los dos empiezan apagados.
--
-- La llamada lleva la misma cabecera secreta que la de `send-reminders` (2.7, `verify_cron_secret`).
-- La dirección de la función va en Vault, distinta en local y en la nube:
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/refresh-prices',
--                              'refresh_prices_url');

-- ─── Qué se mira ────────────────────────────────────────────────────────────────────────────────
-- `price_followed`: la tienda dio precio alguna vez («Actualizar precio» o al pegar el enlace).
-- Escribirlo a mano después no lo apaga; cambiar el enlace, sí.
-- `price_failures`: mañanas seguidas sin precio. A las tres se deja de mirar («Ya no se puede
-- seguir»); un precio de la web, también a mano, lo vuelve a poner a cero.
-- `price_failed_at`: la última vez que no lo dio, para no volver a intentarlo hasta el día siguiente.

alter table public.items
  add column price_followed boolean not null default false,
  add column price_failures smallint not null default 0 check (price_failures >= 0),
  add column price_failed_at timestamptz;

alter table public.item_links
  add column price_followed boolean not null default false,
  add column price_failures smallint not null default 0 check (price_failures >= 0),
  add column price_failed_at timestamptz;

-- Lo de antes: lo que ya tiene un precio de la web, o lo tuvo (una compra sola con su histórico).
update public.items i set price_followed = true
where i.kind = 'shopping' and i.url is not null
  and (i.price_source in ('web', 'auto')
       or exists (select 1 from public.item_prices p
                  where p.item_id = i.id and p.source in ('web', 'auto')));
update public.item_links set price_followed = true where price_source in ('web', 'auto');

-- Lo mantiene al día un trigger, igual en las dos tablas (tienen las mismas columnas): un enlace
-- nuevo empieza de cero; un precio de la web (o automático) que llega lo pone en seguimiento. Llega
-- uno si cambia el precio o su origen, o si se volvió a mirar (la fecha avanza).
create or replace function public.price_follow_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.url is distinct from old.url then
    new.price_followed := false;
    new.price_failures := 0;
    new.price_failed_at := null;
  end if;
  if new.price_cents is not null and new.price_source in ('web', 'auto')
     and (tg_op = 'INSERT'
          or new.price_cents is distinct from old.price_cents
          or new.price_source is distinct from old.price_source
          or new.price_checked_at > coalesce(old.price_checked_at, '-infinity')) then
    new.price_followed := true;
    new.price_failures := 0;
    new.price_failed_at := null;
  end if;
  return new;
end $$;

-- Después de `items_price_before` (orden alfabético), que ya ha puesto la fecha del precio.
create trigger items_price_follow before insert or update on public.items
  for each row execute function public.price_follow_before();
create trigger item_links_price_follow before insert or update on public.item_links
  for each row execute function public.price_follow_before();

-- ─── «Avisarme si baja» ─────────────────────────────────────────────────────────────────────────
-- Una fila por compra y persona que lo pidió: en una lista compartida, cada uno el suyo.
create table public.price_alerts (
  item_id     uuid not null references public.items (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index price_alerts_user_idx on public.price_alerts (user_id);

alter table public.price_alerts enable row level security;

create policy price_alerts_select on public.price_alerts for select to authenticated
  using (user_id = (select auth.uid()));
create policy price_alerts_insert on public.price_alerts for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.items i
                          where i.id = item_id and i.kind = 'shopping'
                            and public.is_list_member(i.list_id)));
create policy price_alerts_delete on public.price_alerts for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── Lo que toca mirar ──────────────────────────────────────────────────────────────────────────
-- Las compras pendientes en seguimiento (sin las de una lista archivada ni una sublista pausada o
-- hecha), con menos de tres fallos y sin mirar en las últimas 20 horas. Con una tienda, el enlace
-- de la compra; con varias, cada tienda. Primero lo que lleva más tiempo sin mirarse.
create or replace function public.price_checks_due(p_limit integer default 5)
returns table (target text, id uuid, url text)
language sql stable security definer set search_path = '' as $$
  with shopping as (
    select i.*
    from public.items i
    join public.lists l on l.id = i.list_id and l.archived_at is null
    left join public.items p on p.id = i.parent_id
    where i.kind = 'shopping' and i.status = 'pending'
      and (i.parent_id is null or public.is_active_sublist_status(p.status))
  ),
  due as (
    select 'item'::text as target, s.id, s.url,
           greatest(s.price_checked_at, s.price_failed_at) as last_seen
    from shopping s
    where s.url is not null and s.price_followed and s.price_failures < 3
      and not exists (select 1 from public.item_links k where k.item_id = s.id)
    union all
    select 'link', k.id, k.url, greatest(k.price_checked_at, k.price_failed_at)
    from public.item_links k
    join shopping s on s.id = k.item_id
    where k.price_followed and k.price_failures < 3
  )
  select d.target, d.id, d.url from due d
  where d.last_seen is null or d.last_seen < now() - interval '20 hours'
  order by d.last_seen nulls first, d.id
  limit p_limit
$$;

-- ─── Lo que se vio ──────────────────────────────────────────────────────────────────────────────
-- Con precio: se guarda como `auto` aunque sea el mismo (así la ficha dice que se miró hoy). Con
-- varias tiendas, el trigger de la 2.2b recalcula la más barata. Sin precio (`null`): un fallo más.
--
-- Si el precio de la compra bajó (el de la más barata, en la misma moneda), devuelve qué decir (con
-- cuándo se miró el de antes, para «20 € menos que ayer») y a quién: quienes pidieron «Avisarme si baja» en ella, siguen en la lista y tienen encendido el
-- interruptor general. Si no bajó, no devuelve nada.
create or replace function public.record_price_check(
  p_target text, p_id uuid, p_price_cents integer, p_currency text default 'EUR')
returns table (
  item_id uuid,
  list_id uuid,
  title text,
  store text,
  before_cents integer,
  after_cents integer,
  currency text,
  before_checked_at timestamptz,
  recipients uuid[]
)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_item_id uuid;
  v_before public.items;
  v_after public.items;
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

  return query
    select v_after.id, v_after.list_id, v_after.title,
           coalesce(v_after.price_store, public.link_store_name(v_after.url_site, v_after.url)),
           v_before.price_cents, v_after.price_cents, v_after.currency, v_before.price_checked_at,
           array(
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
end
$$;

-- ─── «Bajaron esta mañana» ──────────────────────────────────────────────────────────────────────
-- La hoja que abre el aviso de varias bajadas (diseño 22, N3): tus compras con «Avisarme si baja»
-- que bajaron solas hoy (en tu zona) y siguen a ese precio. Con los permisos de quien pregunta.
create or replace function public.my_price_drops()
returns table (
  item_id uuid,
  list_id uuid,
  list_name text,
  title text,
  store text,
  image_url text,
  image_path text,
  price_cents integer,
  previous_price_cents integer,
  currency text
)
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
    and exists (select 1 from public.item_prices p
                where p.item_id = i.id and p.source = 'auto' and p.price_cents = i.price_cents
                  and p.recorded_at >= me.day_start)
  order by l.position, i.position
$$;

revoke execute on function public.my_price_drops() from public, anon;
grant execute on function public.my_price_drops() to authenticated;

-- Solo la función, con `service_role`; nadie desde la app.
revoke execute on function public.price_follow_before() from public, anon, authenticated;
revoke execute on function public.price_checks_due(integer) from public, anon, authenticated;
revoke execute on function public.record_price_check(text, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.price_checks_due(integer) to service_role;
grant execute on function public.record_price_check(text, uuid, integer, text) to service_role;

-- ─── El cron ────────────────────────────────────────────────────────────────────────────────────
-- Cada 10 minutos, pero solo llama de 9:00 a 12:00 en Madrid y si hay algo que mirar: cada llamada
-- mira unas pocas compras (5, con pausas), así que la mañana da para 90. La hora se mira en Madrid
-- y no en UTC, para que no cambie con el horario de verano. Sin la dirección en Vault, no hace nada.
create or replace function public.invoke_refresh_prices()
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  target text;
  secret text;
  local_time time := (now() at time zone 'Europe/Madrid')::time;
begin
  if local_time < time '09:00' or local_time >= time '12:00' then
    return null;
  end if;
  if not exists (select 1 from public.price_checks_due(1)) then
    return null;
  end if;
  select s.decrypted_secret into target
  from vault.decrypted_secrets s where s.name = 'refresh_prices_url';
  select s.decrypted_secret into secret
  from vault.decrypted_secrets s where s.name = 'send_reminders_secret';
  if target is null or secret is null then
    return null;
  end if;
  return net.http_post(
    url := target,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    timeout_milliseconds := 90000
  );
end
$$;

revoke execute on function public.invoke_refresh_prices() from public, anon, authenticated;

select cron.schedule('refresh-prices', '*/10 * * * *', 'select public.invoke_refresh_prices()');
