# lists

Listas del usuario: tipos base y sus plantillas, consultas, mutaciones y componentes.

- `types.ts`, `templates.ts` (etiquetas, descripciones, estados y los textos que dependen de los
  datos: contadores, menú, archivadas, borrado), `schemas.ts` (`listFormSchema`, `field_schema`,
  filas → dominio).
- `api.ts`: lectura (`fetchLists`, `fetchArchivedLists`, `fetchRecentCaptures`) y escritura
  (`createList`, `updateList`, `archiveList`, `unarchiveList`, `deleteList`).
- `queries.ts` y `hooks/`: `useLists`, `useArchivedLists`, `useRecentCaptures` y
  `useListMutations` (archivar, desarchivar y borrar optimistas; crear y editar esperan).
- `components/`: `ListActionsProvider` (formulario y confirmación, una vez en el layout privado) y
  `useListActions`; `ListFormDialog`, `ColorPicker`, `KindPicker`, `ListCardMenu`,
  `DeleteListDialog`, `ArchivedListsSection`, `NewListEntries`, tarjetas y rejilla de Inicio.

**Duplicar (4.4):** `duplicate.ts` (el nombre de la copia y los textos, puro), `DuplicateListDialog`
(la hoja) y `useDuplicateList`, que llama a `duplicate_list` y luego copia las fotos subidas con
`copyItemPhoto` (`features/items/photos.ts`). La abren el menú ··· (`ListCardMenu`), el menú del
botón derecho del sidebar (`ListContextMenu`) y la hoja de una archivada.
