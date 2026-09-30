import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'

import { deleteMessage } from '../templates'
import type { List } from '../types'

interface DeleteListDialogProps {
  list: List | undefined
  onOpenChange: (open: boolean) => void
  onConfirm: (list: List) => void
}

/**
 * Confirmación de borrar una lista (diseño 04 Listas, L10 y D7): dice cuántos ítems se pierden.
 * La lista se recuerda al cerrar, para que el texto no desaparezca mientras se anima.
 */
export function DeleteListDialog({ list, onOpenChange, onConfirm }: DeleteListDialogProps) {
  const [shown, setShown] = useState(list)
  if (list && list !== shown) setShown(list)
  if (!shown) return null

  return (
    <ConfirmDialog
      open={Boolean(list)}
      onOpenChange={onOpenChange}
      title={`¿Borrar «${shown.name}»?`}
      description={deleteMessage(shown)}
      confirmLabel="Borrar"
      onConfirm={() => {
        onConfirm(shown)
      }}
    />
  )
}
