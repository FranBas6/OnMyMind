# today

Vista «Hoy» (sesión 1.11): las tareas con fecha de hoy y las atrasadas de todas las listas,
agrupadas por lista, y al final, plegadas, «Hecho hoy» (lo terminado hoy de cualquier lista) y
«Apuntado hoy» (las notas nuevas), desde el 2026-10-22. Desde la 2.4 (diseño 17), arriba la
«Agenda»: los eventos de hoy de cualquier lista, también los que se repiten, por hora. Desde la
2.5, cualquier día: la tira de la semana y el mes en el móvil, ‹ › y el mes al lado en escritorio,
y `?day=2026-10-14` en la URL. Un día que viene enseña sus eventos y lo que vence; uno pasado,
sus eventos atenuados, «Hecho ese día» y «Apuntado ese día».

- `today.ts`: límites del día, agrupación de hoy (`groupToday`, también la `agenda`) y de otro
  día (`groupDay`), los puntos (`markedDays`), la rejilla del mes (`monthGrid`, `stripMonth`) y
  textos («Atrasada · lunes», «Jueves 8», «Hoy es lunes 5 · dentro de 3 días»).
- `api.ts` y `queries.ts`: Hoy en cuatro consultas en paralelo (pendientes con fecha, lo terminado
  hoy, los eventos próximos de hoy o que se repiten y las notas de hoy) y otro día con
  `fetchDays`, la rejilla de un mes (lo que vence, lo hecho, los eventos y las notas), bajo
  `['items', 'days', '2026-10']`.
- `hooks/useCurrentDay.ts`: el día actual, que cambia a medianoche y al volver a la app.
- `hooks/useToday.ts`: `useToday`, `useOtherDay` y `useMarkedDays`.
- `components/`: `TodayView`, `TodaySection`, `TodayRow`, `AgendaRow`, `DayLog` (`DoneSection`,
  `NotedSection`), `DayCalendar` (`DayStrip`, `MonthCalendar`, `DayAside`) y `TodayEmpty`.

Las filas y el detalle son los de `items` (`ItemWorkspace`).
