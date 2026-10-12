# lists

Listas del usuario: sin tipo desde la 5.3 (ADR-012), con sus textos, consultas, mutaciones y
componentes.

- `types.ts`, `templates.ts` (los textos que dependen de los datos: los contadores comunes
  `tallyLabel` y `listCounterLabel` de la 5.5, menú, archivadas, borrado), `schemas.ts` (`listFormSchema`, `field_schema`,
  filas → dominio).
- `api.ts`: lectura (`fetchLists`, `fetchArchivedLists`, `fetchRecentCaptures`) y escritura
  (`createList`, `updateList`, `updateListView`, `archiveList`, `unarchiveList`, `deleteList`).
- `queries.ts` y `hooks/`: `useLists`, `useArchivedLists`, `useRecentCaptures` y
  `useListMutations` (archivar, desarchivar y borrar optimistas; crear y editar esperan; el orden
  y la vista, `useUpdateListView`, también sin red).
- `components/`: `ListActionsProvider` (formulario y confirmación, una vez en el layout privado) y
  `useListActions`; `ListFormDialog`, `ColorPicker`, `ListViewSwitch` («Lista · Agenda»), `ListCardMenu`,
  `DeleteListDialog`, `ArchivedListsSection`, `NewListEntries`, tarjetas y rejilla de Inicio.

**Duplicar (4.4):** `duplicate.ts` (el nombre de la copia y los textos, puro), `DuplicateListDialog`
(la hoja) y `useDuplicateList`, que llama a `duplicate_list` y luego copia las fotos subidas con
`copyItemPhoto` (`features/items/photos.ts`). La abren el menú ··· (`ListCardMenu`), el menú del
botón derecho del sidebar (`ListContextMenu`) y la hoja de una archivada.
