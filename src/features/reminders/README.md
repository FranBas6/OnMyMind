# reminders

Recordatorios de ítems y avisos push (sesión 2.6; el envío, `send-reminders`, es de la 2.7).

- `reminders.ts`: lo puro. Qué avisos admite un ítem (con hora, con día sin hora a las 9:00, sin
  fecha solo «Personalizado…»), cuándo avisaría cada uno (`reminderAt`, lo mismo que
  `reminder_time` en la base), si una opción aún tiene sentido y su nombre.
- `api.ts`: `reminders` (uno por ítem, `upsert` por `item_id`) y `push_subscriptions`
  (`save_push_subscription`).
- `push.ts`: si este dispositivo recibe avisos (`PushState`) y activarlos o desactivarlos con
  `PushManager` y la clave pública de `vapid.ts`.
- `queries.ts` y `hooks/`: `useItemReminder`, `useSetReminder` (optimista, en la fila de las
  mutaciones de ítems), `usePush` y `useReminderField` (la fila «Aviso» de la ficha y su línea).
- `components/`: `ReminderPanels` (las opciones, «Personalizado…» y la línea de debajo),
  `PushPrompt` (activar, bloqueados e instalar) y `ReminderBell` (la campana de las filas).

Importa `items` y `profile` por sus rutas, no por sus índices, porque ellos también la usan
(la ficha, las filas y Perfil): así no hay ciclos.

El service worker que enseña los avisos está en `src/sw/` (`injectManifest`). La hora de un aviso
relativo la pone la base (trigger `reminders_compute`), que también lo mueve al cambiar la fecha
del ítem (`items_sync_reminders`).
