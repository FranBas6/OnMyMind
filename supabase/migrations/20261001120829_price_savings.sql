-- Sesión 2.2 · «Ahorrado» en Perfil (plan 02-fase-2, diseño 16, C1–C3).
--
-- Lo que bajaron las compras que compraste desde su primer precio hasta el que pagaste, en euros:
-- para cada ítem `bought`, su primera fila de `item_prices` en su moneda menos `items.price_cents`,
-- si es positivo. `security invoker`: la RLS de `items` e `item_prices` deja solo lo tuyo.
-- Referencia: docs/concept/03-modelo-de-datos.md §item_prices.

create or replace function public.price_savings()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(greatest(first_price.price_cents - i.price_cents, 0)), 0)::integer
  from public.items i
  join lateral (
    select p.price_cents
    from public.item_prices p
    where p.item_id = i.id and p.currency = i.currency
    order by p.recorded_at, p.id
    limit 1
  ) first_price on true
  where i.kind = 'shopping'
    and i.status = 'bought'
    and i.price_cents is not null
    and i.currency = 'EUR'
$$;

revoke execute on function public.price_savings() from public, anon;
grant execute on function public.price_savings() to authenticated;
