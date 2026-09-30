# items

Ítems dentro de una lista. Desde 2a.1 el tipo es de cada ítem (`Item.kind`: `note`, `task`,
`shopping`, `event`, `sublist`) y la lista solo da el tipo por defecto; mover conserva el tipo salvo
al entrar o salir de «En mente» (`move.ts`) y se cambia desde el detalle (`kind.ts`,
`changeKindPatch`). Estados por tipo de ítem (`status.ts`), campos flexibles (`fields.ts`, de momento
la prioridad de las tareas), consulta y mutaciones optimistas (`api.ts`, `hooks/`) y el detalle de
lista (`components/ListDetail.tsx`) con sus filas (`ItemRow` por el tipo del ítem, `ItemControl`
con su círculo, cuadrado o calendario), filtros, «Fuera de la cabeza» y el campo de añadir con su
selector de tipo. Desde la sesión 1.7; tipos mezclados desde la 2a.2 (diseño 12).
