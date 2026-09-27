import type { List, ListKind } from '@/features/lists'

/** Cómo se llama lo primero que se añade, para el texto del vacío («Escribe la primera tarea…»). */
const FIRST_ITEM: Record<Exclude<ListKind, 'inbox'>, { noun: string; placeholder: string }> = {
  tasks: { noun: 'la primera tarea', placeholder: 'Primera tarea…' },
  shopping: { noun: 'el primer producto', placeholder: 'Primer producto…' },
  events: { noun: 'el primer evento', placeholder: 'Primer evento…' },
  custom: { noun: 'lo primero', placeholder: 'Primer elemento…' },
}

export function firstItemNoun(kind: ListKind): string {
  return FIRST_ITEM[kind === 'inbox' ? 'tasks' : kind].noun
}

/** Texto del campo de añadir: «¿Qué tienes en mente?», «Primera tarea…» o «Añadir a Casa…». */
export function addPlaceholder(list: List, empty: boolean): string {
  if (list.kind === 'inbox') return '¿Qué tienes en mente?'
  return empty ? FIRST_ITEM[list.kind].placeholder : `Añadir a ${list.name}…`
}
