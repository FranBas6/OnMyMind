# capture

Captura rápida (sesión 1.10): la hoja de móvil y el flotante de escritorio, «Guardar en» con los
chips de destino (`destinations.ts`) y todas las listas, el atajo ⌘⇧Espacio y el aviso con
«Deshacer». La abren el botón + (`src/components/Fab.tsx`), el botón del sidebar y la ruta
`/add`.

**Pegar un enlace (2.3):** `links.ts` lo reconoce en lo escrito y decide qué se guarda;
`UrlCapturePreview` es su tarjeta (buscando, sin datos, sin conexión). Si la página tiene precio,
se propone la lista de compras más usada (`shoppingDestination`). La consulta de la página es la
del detalle (`useLinkPreview` en `features/items`), y lo guardado antes de que llegue lo completa
`useFillCapturedLink`.

**Pegar varias líneas (4.3):** una lista pegada con el campo vacío se enseña una cosa por línea
(`PastedLinesBox` y `usePastedLines`, en `features/items`, que comparte con la barra de añadir), y
`CaptureProvider.saveMany` crea una por línea con un solo «Deshacer». Lo puro, en
`features/items/pastedLines.ts`.

**Compartir a OnMyMind (4.7):** la ruta `/share` (el `share_target` del manifiesto en Android y el
Atajo «Guardar en OnMyMind» del iPhone) guarda directo en «En mente» con `useShareTarget`, sin
captura. Lo puro, qué título, enlace y notas salen de lo que manda cada app, está en `share.ts`.
