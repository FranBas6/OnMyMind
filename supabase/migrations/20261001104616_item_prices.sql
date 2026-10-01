-- Sesión 2.1 · El precio de las compras (plan 02-fase-2, diseño 16).
--
-- `items.price_cents` y `items.currency` existen desde la migración inicial. Ahora:
--   · `price_source`: de dónde salió el precio actual. `manual` (escrito a mano), `web` (traído de
--     la página porque se pegó el enlace o se pidió) y `auto` (el refresco programado de la fase 3).
--     El cliente lo manda siempre junto al precio.
--   · `previous_price_cents`: el precio anterior, para la variación de la fila («↓ 8 %») sin ir al
--     histórico por cada fila. Lo pone el trigger.
--   · `price_checked_at`: cuándo se puso o se miró el precio («de la web · hoy»). Lo pone el trigger
--     al cambiar el precio; «Actualizar precio» (2.2) lo renueva aunque el precio no cambie.
--   · `url_site`: el nombre de la web del enlace (`og:site_name`), que en una compra es la tienda.
--   · `item_prices`: el histórico, una fila por cada precio distinto, con su origen.
-- Referencia: docs/concept/03-modelo-de-datos.md §item_prices.

create type public.price_source as enum ('manual', 'web', 'auto');

alter table public.items
  add column price_source public.price_source,
  add column previous_price_cents integer check (previous_price_cents >= 0),
  add column price_checked_at timestamptz,
  add column url_site text check (char_length(url_site) <= 300);

-- ─── Histórico ──────────────────────────────────────────────────────────────────
create table public.item_prices (
  id           bigint generated always as identity primary key,
  item_id      uuid not null references public.items (id) on delete cascade,
  price_cents  integer not null check (price_cents >= 0),
  currency     text not null default 'EUR' check (char_length(currency) = 3),
  source       public.price_source not null default 'manual',
  recorded_at  timestamptz not null default now()
);

create index item_prices_item_idx on public.item_prices (item_id, recorded_at desc);

-- Se lee a través del ítem: quien ve el ítem ve su histórico. Nadie escribe desde el cliente: las
-- filas las pone el trigger (security definer) y se van con el ítem (`on delete cascade`).
alter table public.item_prices enable row level security;

create policy item_prices_select on public.item_prices for select to authenticated
  using (exists (
    select 1 from public.items i
    where i.id = item_prices.item_id and public.is_list_member(i.list_id)
  ));

-- ─── Trigger en dos partes ──────────────────────────────────────────────────────
-- Antes de guardar: si el precio cambia, el que había pasa a ser el anterior y se apunta cuándo.
-- Quitar el precio lo deja todo vacío: si se vuelve a poner, es como el primero.
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
      new.price_checked_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger items_price_before before insert or update of price_cents on public.items
  for each row execute function public.items_price_before();

-- Después de guardar: cada precio nuevo queda en el histórico con su origen. Es `security definer`
-- porque `item_prices` no deja escribir a nadie más; `search_path` vacío, como todas.
create or replace function public.items_track_price()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.price_cents is not null
     and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents) then
    insert into public.item_prices (item_id, price_cents, currency, source)
    values (new.id, new.price_cents, coalesce(new.currency, 'EUR'),
            coalesce(new.price_source, 'manual'));
  end if;
  return null;
end $$;

revoke execute on function public.items_track_price() from public, anon, authenticated;

create trigger items_track_price after insert or update of price_cents on public.items
  for each row execute function public.items_track_price();

-- ─── Contadores ─────────────────────────────────────────────────────────────────
-- El total va en euros: un precio en otra moneda se ve en su fila, pero no suma (plan 02-fase-2,
-- decisión 7). Lo demás, igual que en `sublists`.
create or replace view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null
    and not (i.kind = 'event' and i.recurrence is null and i.due_at < now())))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (i.kind = 'event' and i.recurrence is null and i.due_at < now())))::integer
    as done_count,
  (coalesce(sum(i.price_cents) filter (where i.kind = 'shopping' and i.completed_at is null
    and i.currency = 'EUR'), 0))::integer
    as pending_price_cents
from public.lists l
left join (
  public.items i
  left join public.items p on p.id = i.parent_id
) on i.list_id = l.id
   and i.kind <> 'sublist'
   and (i.parent_id is null or public.is_active_sublist_status(p.status))
group by l.id;
