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

Desde la 2.8, `photoCleanup.ts` borra del bucket las fotos que ya no usa ningún ítem (`orphan_photos`) un rato después de quitar o cambiar una foto, o de borrar un ítem o una lista, y una vez al día al abrir la app. En los tests lo sustituye `src/test/setup.ts`.

**Varias fotos (4.5):** las fotos de una cosa están en `item_images` (`Item.images`) y la primera
es `imagePath`. `usePhotoUploads` sube varias a la vez (hasta `MAX_PHOTOS`), `useImageMutation` las
añade, mueve, cambia y quita, `PhotoStrip` es la tira de la ficha (ordenar arrastrando y su menú) y
`PhotoViewer` el visor con varias. `copyItemPhoto` copia una al duplicar una lista.
