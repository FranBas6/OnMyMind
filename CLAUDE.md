# OnMyMind

PWA de listas personalizables para capturar rápidamente tareas, cosas que comprar y eventos.
Lema: "Sácalo de la cabeza". Mobile-first, instalable y usable offline, con Supabase como backend.

> **La documentación funcional vive en `docs/`.** Léela antes de implementar cualquier feature:
> define el comportamiento esperado, el modelo de datos y el diseño (`docs/design/`).
> `docs/` está en `.gitignore`: es local y no se commitea salvo que se pida (`git add -f`).

## Stack

- **Runtime / paquetes**: Node 22 LTS (`.nvmrc`), pnpm (versión fijada en `packageManager`).
- **App**: Vite + React 19 + TypeScript estricto.
- **Estilos**: Tailwind CSS v4 (`@tailwindcss/vite`, sin `tailwind.config.js`; tokens en CSS con
  `@theme`) + shadcn/ui (new-york, neutral, variables CSS) + lucide-react.
- **Routing y datos**: TanStack Router (file-based, plugin de Vite) + TanStack Query.
- **Formularios**: react-hook-form + zod (`@hookform/resolvers`).
- **Backend**: Supabase (`@supabase/supabase-js`: auth, base de datos, storage, realtime) y
  Supabase CLI para migraciones y edge functions locales.
- **PWA**: vite-plugin-pwa (`generateSW`, registro automático).
- **Otros**: Recharts (gráficas de precios), @dnd-kit (reordenar), date-fns con locale `es`,
  next-themes (modo oscuro con clase `.dark`), sonner (toasts).
- **Tooling**: ESLint 9 (flat config, typescript-eslint type-checked, react-hooks,
  react-refresh), Prettier + prettier-plugin-tailwindcss, Vitest + Testing Library + jsdom,
  Husky + lint-staged (pre-commit).

## Estructura

```
src/
  app/            Arranque: main.tsx, router, QueryClient, providers y routeTree.gen.ts (generado)
  routes/         Rutas file-based de TanStack Router (__root.tsx + una por pantalla)
  features/       Código de dominio agrupado por funcionalidad:
    auth/           login, sesión y guardas de ruta
    lists/          listas y sus tipos/plantillas
    items/          ítems, estados y campos flexibles
    capture/        captura rápida y detección de URLs
    today/          vista Hoy
    reminders/      recordatorios y push
    prices/         histórico de precios y gráficas
  components/
    ui/           Componentes generados por shadcn (no editar salvo ajustes de estilo)
    layout/       AppShell, BottomNav, Sidebar
  lib/
    supabase/     client.ts (cliente tipado) y database.types.ts (generado, no editar)
    utils.ts      cn() y helpers genéricos
  hooks/          Hooks genéricos compartidos entre features
  styles/         globals.css: Tailwind, tokens de diseño (@theme), tema claro/oscuro, capa base
  types/          Tipos globales del dominio
  test/           Setup de Vitest y utilidades de test
supabase/
  config.toml     Configuración del stack local de Supabase
  migrations/     Migraciones SQL (supabase migration new <nombre>)
  functions/      Edge functions (scraper de precios, envío de push)
public/logos/     Logos oficiales del diseño (svg/ y png/): no se generan ni se editan aquí
docs/             Documentación funcional y de diseño (local, fuera de git)
```

Dentro de cada feature, organiza por necesidad: `components/`, `hooks/`, `api/` (queries y
mutations de Supabase), `schemas.ts` (zod), `types.ts`. Las rutas de `src/routes/` deben ser finas:
importan de `features/` y componen la pantalla.

## Convenciones

- **Organización por features**, no por tipo de archivo. Lo compartido de verdad va en
  `components/`, `hooks/` o `lib/`.
- **Componentes en PascalCase** (archivo y nombre: `AppShell.tsx`). Los archivos generados por
  shadcn en `components/ui/` mantienen su kebab-case.
- **Hooks con prefijo `use`** (`useSession`, `useListItems`).
- **Sin default exports**, salvo cuando una herramienta lo exija. Las rutas exportan `Route`
  (named) como pide TanStack Router.
- **Tailwind sin CSS suelto**: estilos con utilidades; los tokens nuevos se añaden en
  `src/styles/globals.css` (`@theme` / variables de tema), nunca colores hex en los componentes.
  Usa `cn()` para clases condicionales.
- **Tipado estricto sin `any`** (`strict`, `noUncheckedIndexedAccess`; ESLint lo bloquea). Valida
  en los bordes con zod y deriva los tipos (`z.infer`).
- **Datos con TanStack Query**: nada de fetch en `useEffect`. El cliente de Supabase se importa
  solo desde `@/lib/supabase/client`.
- **Alias `@/`** apunta a `src/`. Usa imports absolutos entre carpetas.
- **Idioma**: UI en español; código (identificadores) en inglés.
- **Commits en Conventional Commits, en español**: `feat: añade captura rápida`,
  `fix: corrige el orden de los ítems`, `chore: ...`, `refactor: ...`, `docs: ...`, `test: ...`.

## Comandos

```bash
pnpm dev              # servidor de desarrollo (http://localhost:5173)
pnpm build            # typecheck + build de producción (genera el service worker)
pnpm preview          # sirve el build (para probar la PWA)
pnpm typecheck        # tsc -b
pnpm lint             # ESLint (0 warnings)
pnpm format           # Prettier (escribe); pnpm format:check solo comprueba
pnpm test             # Vitest una vez; pnpm test:watch en modo watch
pnpm supabase:types   # regenera src/lib/supabase/database.types.ts desde Supabase local

pnpm exec supabase start                  # levanta Supabase local (requiere Docker)
pnpm exec supabase migration new <nombre> # nueva migración
pnpm exec supabase db reset               # aplica migraciones desde cero
```

## Marca

Los logos vienen de Claude Design y están en `public/logos/`. No inventes ni redibujes recursos de
marca: si falta una variante, pídela.

- `svg/omm-mark.svg`: símbolo principal (índigo). `omm-mark-white.svg` sobre fondos de color,
  `omm-mark-dark.svg` para modo oscuro, `omm-mark-mono-black.svg` monocromo.
- `svg/omm-app-icon.svg` / `omm-app-icon-maskable.svg`: icono de app (1024, maskable con zona
  segura del 80 %).
- `png/`: iconos PWA (192, 512, maskable), apple-touch 180, favicon 32, marcas de 512 y wordmark
  `onmymind-logo(-white|-dark).png` de 1200×300.
- Wordmark: Plus Jakarta Sans 800, tracking -0.03em.

## Notas

- `src/app/routeTree.gen.ts` lo genera el plugin de TanStack Router al arrancar `dev`/`build`/`test`.
  Se versiona para que `typecheck` funcione en limpio; no lo edites.
- Tras cada migración, ejecuta `pnpm supabase:types` y commitea el resultado.
- Variables de entorno en `.env.local` (plantilla en `.env.example`). El cliente de Supabase lanza
  un error explícito si faltan.
