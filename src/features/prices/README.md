# prices

El precio de las compras: a mano o traído de la web (`fetch-metadata`), con su histórico en
`item_prices` (sesión 2.1). Lo que se pinta hoy vive en `features/items` (`prices.ts`,
`PriceBlock`, `PriceTotal` y `RowPrice`), porque el precio es un campo más del ítem. Aquí llegan
en la 2.2 la gráfica del histórico (Recharts, carga perezosa), «Actualizar precio» y «Ahorrado».
