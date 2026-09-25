# OnMyMind

**Sácalo de la cabeza.** OnMyMind es una PWA de listas personalizables para capturar en segundos
tareas, cosas que comprar y eventos, y encontrarlas después cuando hacen falta. Funciona en el
móvil como app instalada y también offline.

## Requisitos

- Node 22 LTS (`nvm use` lee `.nvmrc`)
- pnpm (versión fijada en `package.json` → `corepack enable` la activa)
- Docker, solo si quieres levantar Supabase en local

## Arrancar en local

```bash
pnpm install
cp .env.example .env.local        # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# Opcional: Supabase local (muestra la URL y la anon key al terminar)
pnpm exec supabase start

pnpm dev                          # http://localhost:5173
```

Otros comandos: `pnpm build`, `pnpm preview`, `pnpm test`, `pnpm lint`, `pnpm typecheck`,
`pnpm format`.

## Despliegue

- **Producción:** <https://onmymind.pages.dev> (Cloudflare Pages, rama `main`).
- **Previsualización:** cada rama que se sube tiene su URL, por ejemplo
  `https://develop.onmymind.pages.dev`.
- Cloudflare construye con `pnpm build` y publica `dist/`. Las variables `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY` del proyecto de Supabase en la nube están en el panel de Cloudflare
  y se incrustan en el build: cambiarlas exige un nuevo despliegue.
- El esquema de la base de datos se sube con `pnpm exec supabase db push`. Una migración ya
  aplicada en la nube no se edita: los cambios van en una migración nueva.

## Documentación

La documentación funcional y de diseño vive en `docs/`, que es local y no se versiona. Las
convenciones de código y la estructura del proyecto están en [`CLAUDE.md`](CLAUDE.md).
