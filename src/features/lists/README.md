# lists

Listas del usuario: sin tipo desde la 5.3 (ADR-012), con sus textos, consultas, mutaciones y
componentes, y las ocultas (5.8).

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

**Listas ocultas (5.8, diseño 27, ADR-013):** se ocultan para quien lo pide, sin cifrar nada.

- `api.ts`: `fetchLists` y `fetchArchivedLists` piden `my_lists` sin las ocultas (`hidden = false`);
  `fetchHiddenLists` las pide aparte, y `fetchHiddenListIds` solo cuáles son. `hideList` y
  `showList` son una fila de `hidden_lists`.
- `hooks/useHiddenLists.ts`: `useHiddenLists` (solo desbloqueado, en memoria), `useHiddenListIds`
  (se guarda: es lo que pide desbloquear al abrir una y lo que `persister.ts` no guarda) y
  `useForgetHiddenOnLock` (al bloquear, se olvida lo de dentro). `useHideList` y `useShowList`, en
  `useListMutations`.
- `components/`: «Ocultar» y «Mostrar» en `ListCardMenu`; `HideListSheet` (la confirmación);
  `HiddenListsScreen` (Perfil › «Listas ocultas», ruta `/profile/hidden`); `HiddenLocked` (la
  pantalla tapada); `HiddenListGate`, que abre una oculta desde su enlace o un aviso. La cabecera
  (`ListDetailHeader`) dice «Oculta» y vuelve a «Listas ocultas».
- `hidden.ts`: sus textos.

**Iconos y emojis (5.9, diseño 28):** el cuadrado de la lista lleva la inicial, un icono de lucide o
un emoji (`lists.icon`: `lucide:<nombre>`, `emoji:<emoji>` o `null`).

- `src/lib/listIcons.ts` (compartido, porque lo pinta `components/ListIcon`): los 8 grupos de 6
  iconos, los 48 emojis y `parseListIcon`.
- `components/ListIconPicker.tsx`: el cuadrado del formulario y su selector (hoja en el móvil,
  popover en escritorio, con flechas). `ListFormDialog` guarda `icon` con `createList` y
  `updateList`.
