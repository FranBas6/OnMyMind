# today

Vista «Hoy» (sesión 1.11): las tareas con fecha de hoy y las atrasadas de todas las listas,
agrupadas por lista, y «N hechas hoy» plegada al final. Desde la 2.4 (diseño 17), arriba la
«Agenda»: los eventos de hoy de cualquier lista, también los que se repiten, por hora.

- `today.ts`: límites del día, agrupación (también la `agenda`) y textos («Atrasada · lunes»).
- `api.ts` y `queries.ts`: tres consultas en paralelo (pendientes con fecha, hechas hoy y los
  eventos próximos de hoy o que se repiten).
- `hooks/useCurrentDay.ts`: el día actual, que cambia a medianoche y al volver a la app.
- `components/`: `TodayView`, `TodaySection`, `TodayRow`, `AgendaRow`, `DoneTodaySection`,
  `TodayEmpty`.

Las filas y el detalle son los de `items` (`ItemWorkspace`).
