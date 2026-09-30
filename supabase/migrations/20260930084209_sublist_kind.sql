-- Sesión 2a.3 · El tipo de ítem «sublista» (ADR-010, opción A).
--
-- Va solo en su propia migración: un valor nuevo de un enum no se puede usar en la misma
-- transacción en la que se añade, y la siguiente (`sublists`) lo usa en funciones que Postgres
-- valida al crearlas.
alter type public.item_kind add value 'sublist';
