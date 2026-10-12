# OnMyMind

PWA de listas personalizables para capturar rápidamente tareas, cosas que comprar y eventos.
Lema: "Sácalo de la cabeza". Mobile-first, instalable y usable offline, con Supabase como backend.

> **La documentación funcional vive en `docs/concept/` y los planes de desarrollo en `docs/plans/`.**
> Léelos antes de implementar cualquier feature: definen el comportamiento esperado, el modelo de
> datos, el diseño (`docs/design/`) y el orden de trabajo por sesiones.
> `docs/` está en `.gitignore`: es local y no se commitea salvo que se pida (`git add -f`).

## Cómo trabajar en este proyecto

- **Al empezar cada sesión**, lee `docs/concept/README.md` y `docs/plans/README.md`. Este último
  dice qué fase está en curso y enlaza su plan, que trae los documentos a releer y un prompt de
  arranque.
- **Trabaja solo en la fase en curso.** No adelantes trabajo de fases posteriores aunque sea
  pequeño; si surge algo útil para más adelante, anótalo en el plan de esa fase.
- **Cualquier plan nuevo** se escribe en `docs/plans/` (un archivo por plan) y se registra en
  `docs/plans/README.md`. Nunca planes sueltos en el chat.
- **Al terminar**, actualiza el estado de la fase en `docs/plans/README.md` y la documentación
  afectada en `docs/concept/` (y `docs/concept/08-revision-inicial.md` si cierras alguno de sus
  puntos), en el mismo commit que el código.
- **Antes de cerrar la sesión**, `pnpm typecheck && pnpm lint && pnpm test` en verde. Si algo
  queda a medias, se dice explícitamente en las notas de la fase.

## Ramas

- **Dos ramas fijas y nunca se trabaja directamente sobre ellas.** `main` es lo publicado (la rama
  de producción de Cloudflare Pages desde la fase 1.4); `develop` es la de integración.
- **Una rama por fase, paso o tarea**, la unidad de trabajo que tenga sentido. Se crea desde
  `develop` actualizado: `git switch develop && git pull && git switch -c <rama>`.
- **Nombre = intención**: `<tipo>/<fase>-<qué-hace>`, en kebab-case y en español, con el tipo de
  Conventional Commits. Ejemplos: `chore/0-preparar-entorno`, `feat/1.01-esquema-inicial-rls`,
  `feat/1.05-inicio-con-listas`, `fix/1.07-checkbox-no-completa`, `docs/plan-fase-2`,
  `refactor/1.09-swipe-sin-libreria`.
- **La rama vuelve a `develop` con squash** cuando su verificación está hecha y los checks en
  verde: `git switch develop && git merge --squash <rama> && git commit` con un mensaje en
  Conventional Commits (un commit por tarea en `develop`). Después se borra con
  `git branch -D <rama>` (`-D` porque tras un squash git no la considera mergeada) y, si se
  subió, `git push origin --delete <rama>`.
- **`main` avanza al cerrar cada sesión**, solo por fast-forward:
  `git switch main && git merge --ff-only develop && git push`. Si el fast-forward falla, `main`
  tiene algo que `develop` no, y se investiga antes de seguir.
- **Sin pull requests**: el proyecto es de una sola persona. La comprobación la hace el hook
  `.husky/pre-push` (typecheck, `deno check` de las edge functions, lint y tests): un push con algo
  en rojo no sale. Para probar en el
  iPhone antes de avanzar `main`, Cloudflare Pages publica una URL de previsualización por rama
  (`develop` incluida).
- Los commits dentro de la rama siguen siendo Conventional Commits en español.

## Diseño y UX

- El diseño de referencia viene de Claude Design (`docs/design/`, extraído en
  `docs/concept/06-diseno-y-ui.md`). **Cualquier pantalla, componente, flujo, texto de interfaz o
  concepto de UI/UX que no esté en ese diseño se consulta con Fran antes de implementarlo**:
  describe la propuesta en dos o tres frases (qué, dónde, por qué) y espera su respuesta. Esto
  incluye las pantallas que el documento 06 lista como "se diseñan en código".
- **Si el cambio es grande** (una vista nueva, un concepto nuevo, el rediseño de una pantalla,
  una sugerencia de UX importante), además de consultarlo entrega un **prompt para Claude Design**
  listo para pegar, siguiendo la plantilla de `docs/concept/06-diseno-y-ui.md` §"Qué hacer cuando
  el diseño no cubre algo". El resultado exportado se guarda en `docs/design/` y se extrae al
  documento 06 antes de implementar.
- Los ajustes pequeños (espaciado, un estado hover, alinear un token) se resuelven en código
  siguiendo el sistema, y se anotan en el inventario de 06.
- Nunca se inventan ni se redibujan recursos de marca (ver §Marca).

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
  Husky + lint-staged (pre-commit) y typecheck + `deno check` + lint + tests (pre-push). Deno
  (Homebrew) solo comprueba los tipos de `supabase/functions/`.

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
    search/         Buscar: búsqueda en cliente sobre todos los ítems
    profile/        Perfil: nombre, ajustes en `profiles.settings` (tema, lista por defecto)
    reminders/      recordatorios y push
    sharing/        compartir listas: invitar con un enlace, unirse, quién está
    prices/         histórico de precios y gráficas
    private/        la clave privada: la caja cifrada, desbloquear con la clave o la llave del aparato, y el texto de las notas protegidas
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
pnpm functions:check  # deno check de las edge functions (sus index.ts y lo que importan)
pnpm lint             # ESLint (0 warnings)
pnpm format           # Prettier (escribe); pnpm format:check solo comprueba
pnpm test             # Vitest una vez; pnpm test:watch en modo watch
pnpm supabase:types   # regenera src/lib/supabase/database.types.ts desde Supabase local

pnpm db:start              # levanta Supabase local (requiere Docker vía Colima)
pnpm db:stop               # para los contenedores conservando los datos
pnpm db:status             # URLs y claves locales
pnpm db:reset              # aplica migraciones desde cero
pnpm db:migration <nombre> # nueva migración en supabase/migrations/
```

Cualquier otro comando de la CLI de Supabase va con `pnpm exec supabase …`: es una dependencia
de desarrollo, no está instalada de forma global.

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
