-- Sesión 2.2b · Varias tiendas en una compra (plan 02-fase-2, diseño 19).
--
-- Una compra con una sola tienda sigue como en la 2.1: su enlace y su precio viven en `items`.
-- Cuando se añade la segunda, el cliente guarda las dos en `item_links`, y desde entonces:
--   · Cada tienda tiene su enlace, su título, su nombre (`url_site`) y su precio, de la web o a mano.
--   · La compra se queda con el precio de la más barata (decisión de Fran): el trigger
--     `item_links_sync` copia a `items` su precio, su origen, su fecha y cuál es
--     (`price_link_id`, `price_store`). Así la fila, el total, la variación, la gráfica y «Ahorrado»
--     siguen saliendo de `items` sin cambiar nada.
--   · `items.url` y compañía reflejan la primera tienda (la foto es la suya, diseño 19).
--   · Comprada, el precio no se recalcula: es el de donde se compró («¿Dónde lo compraste?»).
--   · Si se quitan tiendas hasta dejar una, esa vuelve a `items` y la compra es como antes.
-- El histórico apunta de qué tienda era cada precio (`item_prices.store`).
-- Referencia: docs/concept/03-modelo-de-datos.md §item_links.

create table public.item_links (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.items (id) on delete cascade,
  url               text not null check (char_length(url) <= 2000),
  url_title         text check (char_length(url_title) <= 300),
  url_site          text check (char_length(url_site) <= 300),
  price_cents       integer check (price_cents >= 0),
  currency          text not null default 'EUR' check (char_length(currency) = 3),
  price_source      public.price_source,
  price_checked_at  timestamptz,
  position          integer not null default 1000,
  created_at        timestamptz not null default now()
);

create index item_links_item_idx on public.item_links (item_id, position);

alter table public.items
  add column price_link_id uuid references public.item_links (id) on delete set null,
  add column price_store text check (char_length(price_store) <= 300);

alter table public.item_prices
  add column store text check (char_length(store) <= 300);

-- Lo de una tienda lo toca quien puede tocar su compra.
alter table public.item_links enable row level security;

create policy item_links_select on public.item_links for select to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_links.item_id and public.is_list_member(i.list_id)));
create policy item_links_insert on public.item_links for insert to authenticated
  with check (exists (select 1 from public.items i
                      where i.id = item_links.item_id and public.is_list_member(i.list_id)));
create policy item_links_update on public.item_links for update to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_links.item_id and public.is_list_member(i.list_id)))
  with check (exists (select 1 from public.items i
                      where i.id = item_links.item_id and public.is_list_member(i.list_id)));
create policy item_links_delete on public.item_links for delete to authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_links.item_id and public.is_list_member(i.list_id)));

-- El nombre de una tienda: el que da la web o, si no, el dominio sin «www.».
create or replace function public.link_store_name(p_site text, p_url text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(p_site, ''),
                  regexp_replace(substring(p_url from '^[a-zA-Z]+://([^/:?#]+)'), '^www\.', ''))
$$;

-- ─── Sincronizar la compra con sus tiendas ──────────────────────────────────────
create or replace function public.item_links_sync()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_item_id uuid := coalesce(new.item_id, old.item_id);
  v_item public.items;
  v_count integer;
  v_first public.item_links;
  v_best public.item_links;
begin
  select * into v_item from public.items where id = v_item_id;
  -- La compra ya no existe (se está borrando con sus tiendas) o ya no es una compra.
  if v_item.id is null or v_item.kind <> 'shopping' then
    return null;
  end if;

  select count(*) into v_count from public.item_links where item_id = v_item_id;

  if v_count = 0 then
    return null;
  end if;

  -- Queda una sola al quitar: vuelve a la compra y la compra es como antes.
  if v_count = 1 then
    if tg_op = 'DELETE' then
      select * into v_first from public.item_links where item_id = v_item_id;
      update public.items
      set url = v_first.url, url_title = v_first.url_title, url_site = v_first.url_site,
          price_link_id = null, price_store = null,
          price_cents = case when v_item.status = 'bought' then v_item.price_cents
                             else v_first.price_cents end,
          currency = case when v_item.status = 'bought' then v_item.currency
                          else v_first.currency end,
          price_source = case when v_item.status = 'bought' then v_item.price_source
                              else v_first.price_source end,
          price_checked_at = case when v_item.status = 'bought' then v_item.price_checked_at
                                  else v_first.price_checked_at end
      where id = v_item_id;
      delete from public.item_links where id = v_first.id;
    end if;
    return null;
  end if;

  -- La primera tienda es la del enlace de la compra.
  select * into v_first from public.item_links
  where item_id = v_item_id order by position, created_at limit 1;

  -- La más barata con precio: primero en euros, que es lo que suma el total.
  select * into v_best from public.item_links
  where item_id = v_item_id and price_cents is not null
  order by (currency <> 'EUR'), price_cents, position limit 1;

  if v_item.status = 'bought' then
    update public.items
    set url = v_first.url, url_title = v_first.url_title, url_site = v_first.url_site
    where id = v_item_id;
  elsif v_best.id is null then
    update public.items
    set url = v_first.url, url_title = v_first.url_title, url_site = v_first.url_site,
        price_cents = null, price_link_id = null, price_store = null
    where id = v_item_id;
  else
    update public.items
    set url = v_first.url, url_title = v_first.url_title, url_site = v_first.url_site,
        price_cents = v_best.price_cents, currency = v_best.currency,
        price_source = v_best.price_source, price_checked_at = v_best.price_checked_at,
        price_link_id = v_best.id,
        price_store = public.link_store_name(v_best.url_site, v_best.url)
    where id = v_item_id;
  end if;
  return null;
end $$;

create trigger item_links_sync after insert or update or delete on public.item_links
  for each row execute function public.item_links_sync();

-- ─── El precio de la compra ─────────────────────────────────────────────────────
-- Igual que en la 2.1, pero respeta la fecha que trae el cambio: la de la tienda que lo dio.
create or replace function public.items_price_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.price_cents is not null then
      new.price_checked_at := coalesce(new.price_checked_at, now());
    end if;
  elsif new.price_cents is distinct from old.price_cents then
    if new.price_cents is null then
      new.previous_price_cents := null;
      new.price_source := null;
      new.price_checked_at := null;
    else
      new.previous_price_cents := old.price_cents;
      if new.price_checked_at is not distinct from old.price_checked_at then
        new.price_checked_at := now();
      end if;
    end if;
  end if;
  return new;
end $$;

-- El histórico apunta de qué tienda era cada precio.
create or replace function public.items_track_price()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price_cents is not null
     and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents) then
    insert into public.item_prices (item_id, price_cents, currency, source, store)
    values (new.id, new.price_cents, coalesce(new.currency, 'EUR'),
            coalesce(new.price_source, 'manual'),
            coalesce(new.price_store, public.link_store_name(new.url_site, new.url)));
  end if;
  return null;
end $$;
