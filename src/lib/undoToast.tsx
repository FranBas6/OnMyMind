import { toast } from 'sonner'

import { UndoToast, type UndoToastProps } from '@/components/UndoToast'

/** Cuánto dura el aviso con «Deshacer» (diseño 04 Listas y 06 Detalle de tarea). */
export const UNDO_MS = 5000

/** Enseña el aviso durante `UNDO_MS`; «Deshacer» (si hay `onUndo`) lo cierra y lo llama. */
export function showUndoToast({ icon, message, onUndo }: UndoToastProps) {
  toast.custom(
    (id) => (
      <UndoToast
        icon={icon}
        message={message}
        onUndo={
          onUndo &&
          (() => {
            toast.dismiss(id)
            onUndo()
          })
        }
      />
    ),
    { duration: UNDO_MS, position: 'bottom-center' },
  )
}
