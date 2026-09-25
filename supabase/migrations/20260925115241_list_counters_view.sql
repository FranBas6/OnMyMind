-- Contadores de cada lista para Inicio y el sidebar (sesión 1.5).
-- Referencia: docs/concept/03-modelo-de-datos.md §Consultas clave (Inicio).

-- `security_invoker = true`: la vista se ejecuta con los permisos de quien consulta, así que
-- respeta el RLS de `lists` e `items` y solo devuelve las listas del usuario. Sin esa opción,
-- una vista corre con los permisos de su dueño (postgres) y se saltaría RLS.
--
-- «Pendiente» = sin completar, salvo los eventos ya pasados sin repetición: siguen en
-- `upcoming` (el estado pasado no se guarda, ver 03) pero ya están fuera de la cabeza.
create view public.list_counters
with (security_invoker = true) as
select
  l.id as list_id,
  (count(i.id) filter (where i.completed_at is null
    and not (l.kind = 'events' and i.recurrence is null and i.due_at < now())))::integer
    as pending_count,
  (count(i.id) filter (where i.completed_at is not null
    or (l.kind = 'events' and i.recurrence is null and i.due_at < now())))::integer
    as done_count,
  -- Total pendiente en compras, en céntimos (fase 1: se asume una sola moneda, EUR).
  (coalesce(sum(i.price_cents) filter (where l.kind = 'shopping' and i.completed_at is null), 0))::integer
    as pending_price_cents
from public.lists l
left join public.items i on i.list_id = l.id
group by l.id;
