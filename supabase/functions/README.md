# Edge functions

Las edge functions de Supabase (Deno), una carpeta por función:

- **`fetch-metadata`** (2a.6): el título y la imagen de la página de un enlace, para la foto y el
  enlace de cualquier ítem. La extracción vive en `metadata.ts`, que es puro y se prueba con Vitest
  (`metadata.test.ts`). Sin precio todavía: llega con Compras (2.1).
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
