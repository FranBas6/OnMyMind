# capture

Captura rápida (sesión 1.10): la hoja de móvil y el flotante de escritorio, «Guardar en» con los
chips de destino (`destinations.ts`) y todas las listas, el atajo ⌘⇧Espacio y el aviso con
«Deshacer». La abren el botón + (`src/components/Fab.tsx`), el botón del sidebar y la ruta
`/add` (también el Atajo de iOS «Guardar en OnMyMind», con `?url=`).

**Pegar un enlace (2.3):** `links.ts` lo reconoce en lo escrito y decide qué se guarda;
`UrlCapturePreview` es su tarjeta (buscando, sin datos, sin conexión). Si la página tiene precio,
se propone la lista de compras más usada (`shoppingDestination`). La consulta de la página es la
del detalle (`useLinkPreview` en `features/items`), y lo guardado antes de que llegue lo completa
`useFillCapturedLink`.
