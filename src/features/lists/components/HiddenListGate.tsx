import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { useUnlocked } from '@/features/private'

import { useHiddenLists } from '../hooks/useHiddenLists'
import type { List } from '../types'
import { useSeenUnlocked } from '../hooks/useSeenUnlocked'
import { HiddenLocked } from './HiddenLock'

/**
 * Una lista oculta abierta (5.8, diseño 27): desde su tarjeta en «Listas ocultas», un aviso o un
 * enlace. Bloqueado, la pantalla tapada pide desbloquear (D6b); desbloqueado, la lista como
 * siempre (D5). Si deja de estar oculta o ya no está, a «Listas ocultas».
 */
export function HiddenListGate({
  listId,
  children,
}: {
  listId: string
  children: (list: List) => ReactNode
}) {
  const unlocked = useUnlocked() !== null
  const seen = useSeenUnlocked(unlocked)
  const hidden = useHiddenLists()

  if (!unlocked) {
    return (
      <div className="flex min-h-[70dvh] flex-col">
        <HiddenLocked what="list" wasUnlocked={seen} />
      </div>
    )
  }
  if (hidden.isError) {
    return (
      <p role="alert" className="px-1 text-[15px] text-muted-foreground">
        No hemos podido cargar esta lista. Prueba otra vez en un momento.
      </p>
    )
  }
  if (!hidden.data) return null
  const list = hidden.data.find((entry) => entry.id === listId)
  if (!list) return <Navigate to="/profile/hidden" replace />
  return children(list)
}
