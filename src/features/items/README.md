# items

Ítems dentro de una lista. Desde 2a.1 el tipo es de cada ítem (`Item.kind`: `note`, `task`,
`shopping`, `event`, `sublist`) y la lista solo da el tipo por defecto; mover conserva el tipo salvo
al entrar o salir de «En mente» (`move.ts`) y se cambia desde el detalle (`kind.ts`,
`changeKindPatch`). Estados por tipo de ítem (`status.ts`), campos flexibles (`fields.ts`, de momento
la prioridad de las tareas), consulta y mutaciones optimistas (`api.ts`, `hooks/`) y el detalle de
lista (`components/ListDetail.tsx`) con sus filas (`ItemRow` por el tipo del ítem, `ItemControl`
con su círculo, cuadrado o calendario), filtros, «Fuera de la cabeza» y el campo de añadir con su
selector de tipo. Las sublistas (`sublists.ts`: contadores con las reglas de `list_counters`,
textos y duplicar) se ven con `SublistRow` y se abren en el mismo `ListDetail` con `sublist`.
Desde la sesión 1.7; tipos mezclados desde la 2a.2 y sublistas desde la 2a.4 (diseño 12). Desde
la 2a.6 (diseño 15), una foto y un enlace en cualquier ítem: `links.ts`, `photos.ts` (reducir,
subir a `item-images` y URLs firmadas), `hooks/usePhoto.ts`, `ItemMedia` y `PhotoViewer` en el
detalle, y `RowThumb` / `LinkMeta` en las filas. El título y la imagen de la página los trae la
edge function `fetch-metadata`. Desde la 2.4 (diseño 17), los eventos: `events.ts` (cuándo pasa uno,
la siguiente vez de uno que se repite, los grupos por días y los textos), `EventsList` y `EventRow`
en una lista de eventos, y `EventWhenField` («Cuándo») en el detalle.
