# lists

Listas del usuario: tipos base y sus plantillas, consultas y componentes de Inicio.

- `types.ts`: `List`, `ListKind`, `ListColor`, `ListCounters`.
- `templates.ts`: por tipo, su etiqueta, sus estados y la etiqueta del contador
  (`counterLabel`, `listSummary`).
- `schemas.ts`: zod de `field_schema` y `mergeListsWithCounters` (filas → dominio).
- `api.ts`: `fetchLists` (tabla `lists` + vista `list_counters`).
- `queries.ts`: `listsQueryOptions`, compartida por `useLists` y el loader de Inicio.
- `hooks/useLists.ts`: separa «En mente» del resto con `select`.
- `components/`: `InboxCard`, `ListCard`, `ListGrid`, `ListsSkeleton`.

Solo lectura por ahora; crear, editar, archivar y borrar llegan en 1.6.
