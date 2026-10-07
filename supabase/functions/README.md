# Edge functions

Las edge functions de Supabase (Deno), una carpeta por función:

- **`fetch-metadata`** (2a.6 y 2.1): el título, la imagen, el nombre de la web y el precio de la
  página de un enlace, para la foto y el enlace de cualquier ítem y el precio de una compra. El
  precio sale por capas: JSON-LD `Product`, las meta `product:price` y los microdatos (ADR-007). Lee
  hasta 2 MB, porque el JSON-LD suele ir en el cuerpo. Solo contesta a usuarios con sesión (la
  clave `anon` recibe un 401). La extracción vive en `metadata.ts`, que es puro y se prueba con
  Vitest (`metadata.test.ts`).
- **`send-reminders`** (2.7): envía los avisos vencidos y el resumen de Hoy. La llama `pg_cron`
  cada minuto con `pg_net` y la cabecera `x-cron-secret` (migración `send_reminders_cron`; el
  secreto vive en Vault y lo comprueba `verify_cron_secret`). Sin la puerta de JWT
  (`verify_jwt = false`), porque no la llama un usuario. Push con `@negrel/webpush` (JSR,
  WebCrypto). Los textos y qué se envía viven en `messages.ts`, puro y probado con Vitest.
  Necesita el secreto `VAPID_PRIVATE_KEY`, y para encenderla, la dirección en Vault:
  `select vault.create_secret('<url de la función>', 'send_reminders_url');`.
- **`calendar-feed`** (3.7): los eventos de una persona como calendario suscrito (iCalendar), para
  el Calendario del iPhone o del Mac: `…/functions/v1/calendar-feed/<enlace>.ics`. Sin la puerta de
  JWT (`verify_jwt = false`): el Calendario no sabe iniciar sesión, así que el enlace secreto de
  Perfil es la llave. Lee con `calendar_feed` (solo `service_role`); un enlace que no existe da 404.
  El texto sale de `ical.ts`, puro y probado con Vitest (`ical.test.ts`). No necesita secretos.
- Más adelante: el refresco de precios.

Crear o servir una función en local (necesita `[edge_runtime] enabled = true` en `config.toml`,
apagado de serie para ahorrar ~1 GB de imagen):

```bash
pnpm exec supabase functions new <nombre>
pnpm exec supabase functions serve
# send-reminders necesita la clave VAPID: un archivo con solo esa línea, fuera del repo
pnpm exec supabase functions serve send-reminders --env-file <archivo>
```

Publicarla en la nube (`--use-api` la empaqueta en Supabase, sin bajar la imagen de ~1 GB):

```bash
pnpm exec supabase functions deploy fetch-metadata --use-api
pnpm exec supabase functions deploy send-reminders --use-api
pnpm exec supabase functions deploy calendar-feed --use-api
```
