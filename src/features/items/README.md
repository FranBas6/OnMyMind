# items

Ítems dentro de una lista. Desde 2a.1 el tipo es de cada ítem (`Item.kind`: `note`, `task`,
`shopping`, `event`) y la lista solo da el tipo por defecto; mover conserva el tipo salvo al entrar o
salir de «En mente» (`move.ts`). Estados por tipo de ítem (`status.ts`), campos flexibles (`fields.ts`, de
momento la prioridad de las tareas), consulta y mutaciones optimistas (`api.ts`, `hooks/`) y el
detalle de lista (`components/ListDetail.tsx`) con sus filas, filtros, «Fuera de la cabeza» y el
campo de añadir. Desde la sesión 1.7.
