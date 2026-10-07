import { useUndoRepeat, type Completion } from '@/features/items'

/** El checkbox de una vez hecha la deshace: la tarea vuelve a la fecha que tenía. */
export function useUndoCompletion() {
  const undo = useUndoRepeat()
  return (completion: Completion) => {
    undo.mutate({ item: completion.item, occurrence: completion.occurrence })
  }
}
