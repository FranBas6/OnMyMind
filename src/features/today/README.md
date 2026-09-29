# today

Vista «Hoy» (sesión 1.11): las tareas con fecha de hoy y las atrasadas de todas las listas,
agrupadas por lista, y «N hechas hoy» plegada al final.

- `today.ts`: límites del día, agrupación y textos («Atrasada · lunes»).
- `api.ts` y `queries.ts`: dos consultas en paralelo (pendientes con fecha y hechas hoy).
- `hooks/useCurrentDay.ts`: el día actual, que cambia a medianoche y al volver a la app.
- `components/`: `TodayView`, `TodaySection`, `TodayRow`, `DoneTodaySection`, `TodayEmpty`.

Las filas y el detalle son los de `items` (`ItemWorkspace`).
