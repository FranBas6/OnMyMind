/** El id del campo grande de Buscar: el sidebar y ⌘K le pasan el foco. */
export const SEARCH_FIELD_ID = 'search-field'

/** Pone el foco en el campo grande de Buscar, con el cursor al final de lo escrito. */
export function focusSearchField() {
  const field = document.getElementById(SEARCH_FIELD_ID)
  if (!(field instanceof HTMLInputElement)) return
  field.focus()
  field.setSelectionRange(field.value.length, field.value.length)
}
