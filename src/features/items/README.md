# items

**Carpetas (6.7–6.8).** En la raíz, el núcleo: tipos (`types.ts`), estados (`status.ts`), campos
(`fields.ts`), textos (`copy.ts`), la api, los esquemas y las consultas; en `hooks/`, las
mutaciones y `useItems`. El resto, por temas, cada uno con su lógica, sus componentes y sus tests:
`kind/` (el tipo), `workspace/` (lo que comparten la lista y Hoy al abrir y cambiar cosas), `list/`
(el detalle de lista y «Fuera de la cabeza»), `rows/` (las filas, deslizar y el menú), `detail/`
(la ficha), `add/` (la barra de añadir y las fechas escritas), `move/`, `dates/` (fecha y
repetición), `notes/`, `events/`, `shopping/` (precio y tiendas), `payments/`, `sublists/` (y
«elegir una») y `media/` (fotos, enlaces y documentos). Otras features entran por `index.ts`
(ESLint lo exige en sus componentes y hooks, 6.10).

Ítems dentro de una lista. Desde 2a.1 el tipo es de cada ítem (`Item.kind`: `note`, `task`,
`shopping`, `event`, `sublist`); desde la 5.3 (ADR-012) las listas no tienen tipo y proponen el que
más tienen (`kindProposal`), mover nunca lo cambia (`move/move.ts`) y se cambia desde el detalle
(`kind/kind.ts`, `changeKindPatch`). Estados por tipo de ítem (`status.ts`), campos flexibles (`fields.ts`, de momento
la prioridad de las tareas), consulta y mutaciones optimistas (`api.ts`, `hooks/`) y el detalle de
lista (`list/ListDetail.tsx`) con sus filas (`ItemRow` por el tipo del ítem, `ItemControl`
con su círculo, cuadrado o calendario), filtros, «Fuera de la cabeza» y el campo de añadir con su
selector de tipo. Las sublistas (`sublists/sublists.ts`: contadores con las reglas de `list_counters`,
textos y duplicar) se ven con `SublistRow` y se abren en el mismo `ListDetail` con `sublist`.
Desde la sesión 1.7; tipos mezclados desde la 2a.2 y sublistas desde la 2a.4 (diseño 12). Desde
la 2a.6 (diseño 15), una foto y un enlace en cualquier ítem: `media/links.ts`, `media/photos.ts` (reducir,
subir a `item-images` y URLs firmadas), `media/usePhoto.ts`, `ItemMedia` y `PhotoViewer` en el
detalle, y `RowThumb` / `LinkMeta` en las filas. El título y la imagen de la página los trae la
edge function `fetch-metadata`. Desde la 2.4 (diseño 17), los eventos: `events/events.ts` (cuándo pasa uno,
la siguiente vez de uno que se repite, los grupos por días y los textos), `EventsList` y `EventRow`
en una lista de eventos (desde la 5.5, la vista Agenda de cualquier lista, con «Sin fecha» plegado), y `EventWhenField` («Cuándo») en el detalle.

Desde la 2.8, `media/photoCleanup.ts` borra del bucket las fotos que ya no usa ningún ítem (`orphan_photos`) un rato después de quitar o cambiar una foto, o de borrar un ítem o una lista, y una vez al día al abrir la app. Desde la 6.1, también los documentos (`orphan_files`). En los tests lo sustituye `src/test/setup.ts`.

Desde la 6.1 (diseño 29), una cosa lleva hasta 5 documentos (`item_files`, bucket `item-files`): `media/files.ts` (tipos, tamaños, subir con progreso y los enlaces firmados), `media/useFileUploads.ts` (lo que sube y los enlaces de la ficha), `fileMutation` en `hooks/useItemMutations.ts` y `media/ItemFiles.tsx` (la caja «Documentos»), que `ItemMedia` pone junto a las fotos y los enlaces.

**Varias fotos (4.5):** las fotos de una cosa están en `item_images` (`Item.images`) y la primera
es `imagePath`. `usePhotoUploads` sube varias a la vez (hasta `MAX_PHOTOS`), `useImageMutation` las
añade, mueve, cambia y quita, `PhotoStrip` es la tira de la ficha (ordenar arrastrando y su menú) y
`PhotoViewer` el visor con varias. `copyItemPhoto` copia una al duplicar una lista.

**Varios enlaces (4.6):** con dos o más, los enlaces de cualquier tipo están en `item_links`
(`Item.links`), como las tiendas de una compra, y el primero es `url`. `hasLinks` dice si hay
varios y `hasStores` si además es una compra. `withLinks` deja la cosa como `item_links_sync`, con
precio solo en las compras, y `regainCheapest` devuelve el de la más barata al volver a ser compra.
`LinksSection` es la caja «Enlaces», `LinkOptions` las opciones de una tienda o un enlace, y
`useItemLinkMetadata` busca el título de cada uno (y el precio, si es una tienda).

**La nota (5.4, diseño 25):** `NoteRow` es su fila (la hoja de `ItemControl` en el sitio de la
casilla y el principio del resto en dos líneas) y la ficha, `NoteTextField`: un solo texto con dos
campos que se comportan como uno (`NoteEditor`, que también usa la captura). Se guarda partido con
`notes/noteText.ts` (`splitNoteText`: la primera línea al título y el resto a las notas; `noteBody` no
repite el título en lo compartido antes de la 5.4), y `notes/bullets.ts` hace las viñetas. «Pasar a
tarea» y «Copiar el texto» son acciones de fila de la nota (`rowActions`), y `changeKind` en
`ItemWorkspace` cambia el tipo con «Ahora es una tarea · Deshacer» (`revertKindChange`). Pegar
varias líneas al crear una nota las deja en una (`PastedNoteBox`, `usePastedLines` con `single`).

**Notas protegidas (5.7, diseño 26):** `Item.sealed` es el texto cifrado de una protegida (con
`notes` vacío). `ProtectedNote` es su ficha (bloqueada con `LockedNoteCard` o desbloqueada, con la
franja, el texto que se cifra otra vez al guardarlo, «Copiar» y el botón de copiar de cada
línea, que copia solo el valor de «Contraseña: 123456», `notes/lineValue.ts`), `ProtectedKindRow` su «Tipo», y
`protect` / `unprotect` de `ItemWorkspace` la protegen y le quitan la protección (con conexión).
`notes/protection.ts` dice por qué no se puede (compartida, con fotos o enlaces); `useRowActionsContext`
lo pone en el menú («Proteger» en gris con su porqué). `ProtectedNotesGate` va en la hoja de
compartir: una lista con protegidas no se comparte hasta moverlas. «Mover a…» no ofrece listas
compartidas para una protegida.
