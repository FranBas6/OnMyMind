-- Sesión 4.6 · Varios enlaces (plan 04-fase-4, diseño 23, D11–D13).
--
-- Una tarea, un evento o una nota puede tener varios enlaces, como una compra tiene varias tiendas
-- (2.2b), pero sin precio. Van en la misma tabla, `item_links`, con la misma regla: con uno, vive
-- en `items.url`; con dos o más, todos van a `item_links` y la cosa se queda con el primero.
--   · `item_links_sync` deja de ignorar lo que no es compra: copia el primer enlace en todos los
--     tipos, y el precio de la más barata solo en las compras. Al quedar uno, vuelve a la cosa.
--   · Cambiar el tipo no pierde nada: una compra que pasa a tarea conserva sus tiendas, con sus
--     precios, aunque no se vean; al volver a compra, `items_kind_links` le devuelve el precio de
--     la más barata.
--   · Duplicar, «Deshacer», exportar y borrar la cuenta ya copian `item_links` sin mirar el tipo.
-- Referencia: docs/concept/03-modelo-de-datos.md §item_links.

-- ─── Sincronizar la cosa con sus enlaces ──────────────────────────────────────────────────────
create or replace function public.item_links_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item_id uuid := coalesce(new.item_id, old.item_id);
  v_item public.items;
  v_count integer;
  v_first public.item_links;
  v_best public.item_links;
  v_shopping boolean;
begin
  select * into v_item from public.items where id = v_item_id;
  -- La cosa ya no existe (se está borrando con sus enlaces).
  if v_item.id is null then
    return null;
  end if;
  -- Lo que no es compra no tiene precio (y lo que guarden sus enlaces no se toca).
  v_shopping := v_item.kind = 'shopping';

  select count(*) into v_count from public.item_links where item_id = v_item_id;

  if v_count = 0 then
    return null;
  end if;

  -- Queda uno solo al quitar: vuelve a la cosa y la cosa es como antes.
  if v_count = 1 then
    if tg_op = 'DELETE' then
      select * into v_first from public.item_links where item_id = v_item_id;
      if v_shopping then
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
      else
        update public.items
        set url = v_first.url, url_title = v_first.url_title, url_site = v_first.url_site,
            price_link_id = null, price_store = null
        where id = v_item_id;
      end if;
      delete from public.item_links where id = v_first.id;
    end if;
    return null;
  end if;

  -- El primer enlace es el de la cosa.
  select * into v_first from public.item_links
  where item_id = v_item_id order by position, created_at limit 1;

  -- La más barata con precio: primero en euros, que es lo que suma el total.
  select * into v_best from public.item_links
  where item_id = v_item_id and price_cents is not null
  order by (currency <> 'EUR'), price_cents, position limit 1;

  if not v_shopping or v_item.status = 'bought' then
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

-- ─── Volver a ser compra ──────────────────────────────────────────────────────────────────────
-- Con varias tiendas guardadas, la compra recupera el precio de la más barata. Antes que
-- `items_price_before` (orden alfabético), aunque esa solo corre si el cambio trae el precio: por
-- eso aquí se ponen también su fecha y el anterior (la tarea no tenía precio).
create or replace function public.items_kind_links()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_best public.item_links;
begin
  if new.kind <> 'shopping' or old.kind = 'shopping'
     or (select count(*) from public.item_links where item_id = new.id) < 2 then
    return new;
  end if;
  select * into v_best from public.item_links
  where item_id = new.id and price_cents is not null
  order by (currency <> 'EUR'), price_cents, position limit 1;
  if v_best.id is null then
    new.price_cents := null;
    new.price_link_id := null;
    new.price_store := null;
  else
    new.price_cents := v_best.price_cents;
    new.currency := v_best.currency;
    new.price_source := v_best.price_source;
    new.price_checked_at := coalesce(v_best.price_checked_at, now());
    new.previous_price_cents := null;
    new.price_link_id := v_best.id;
    new.price_store := public.link_store_name(v_best.url_site, v_best.url);
  end if;
  return new;
end $$;

create trigger items_kind_links before update of kind on public.items
  for each row execute function public.items_kind_links();
