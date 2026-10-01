# Edge functions

Las edge functions de Supabase (Deno), una carpeta por función:

- **`fetch-metadata`** (2a.6 y 2.1): el título, la imagen, el nombre de la web y el precio de la
  página de un enlace, para la foto y el enlace de cualquier ítem y el precio de una compra. El
  precio sale por capas: JSON-LD `Product`, las meta `product:price` y los microdatos (ADR-007). Lee
  hasta 2 MB, porque el JSON-LD suele ir en el cuerpo. Solo contesta a usuarios con sesión (la
  clave `anon` recibe un 401). La extracción vive en `metadata.ts`, que es puro y se prueba con
  Vitest (`metadata.test.ts`).
- Más adelante: el envío de push (recordatorios) y el refresco de precios.

Crear o servir una función en local (necesita `[edge_runtime] enabled = true` en `config.toml`,
apagado de serie para ahorrar ~1 GB de imagen):

```bash
pnpm exec supabase functions new <nombre>
pnpm exec supabase functions serve
```

Publicarla en la nube (`--use-api` la empaqueta en Supabase, sin bajar la imagen de ~1 GB):

```bash
pnpm exec supabase functions deploy fetch-metadata --use-api
```
