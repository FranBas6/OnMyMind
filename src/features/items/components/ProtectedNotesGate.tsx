import { ChevronDown, Lock, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { OutlineButton } from '@/components/OutlineButton'
import { useLists, type List } from '@/features/lists'
// Por su ruta y no por el índice: `sharing` usa piezas de `items`.
import { useSharedPeople } from '@/features/sharing/hooks/useSharing'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { useMoveItem } from '../hooks/useItemMutations'
import { useItems } from '../hooks/useItems'

/** «2 notas protegidas», «1 nota protegida». */
const protectedLabel = (count: number) =>
  count === 1 ? '1 nota protegida' : `${count} notas protegidas`

/**
 * Compartir una lista con notas protegidas (5.7, diseño 26, C9b): no se puede, porque quien entre
 * no tiene tu clave. En lugar de invitar, cuáles son y «Mover las protegidas a…» otra lista tuya
 * sin compartir; al no quedar ninguna, vuelve el enlace de invitación (`children`).
 */
export function ProtectedNotesGate({ list, children }: { list: List; children: ReactNode }) {
  const { data: items } = useItems(list.id)
  const lists = useLists().data
  const shared = useSharedPeople().data
  const moveItem = useMoveItem()
  const [choosing, setChoosing] = useState(false)
  const sealed = (items ?? []).filter((item) => item.sealed !== null)

  if (sealed.length === 0) return <>{children}</>

  // A dónde: tus otras listas sin compartir, «En mente» incluida.
  const destinations = lists
    ? [...(lists.inbox ? [lists.inbox] : []), ...lists.lists].filter(
        (entry) => entry.id !== list.id && (shared?.get(entry.id)?.length ?? 0) <= 1,
      )
    : []

  const moveAll = (to: List) => {
    for (const item of sealed) moveItem.mutate({ item, from: list, to })
    setChoosing(false)
    showUndoToast({
      icon: Lock,
      message: `${sealed.length === 1 ? 'Movida' : 'Movidas'} a ${to.name}. Ya puedes invitar.`,
    })
  }

  return (
    <>
      <p className="flex gap-2 rounded-2xl bg-fill px-3.5 py-3 text-[13.5px] leading-[1.45]">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
        <span>
          Esta lista tiene <b className="font-bold">{protectedLabel(sealed.length)}</b>. Quien entre
          no tiene tu clave, así que no se puede compartir con ellas dentro. Muévelas a otra lista o
          quítales la protección.
        </span>
      </p>
      <ul className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        {sealed.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              'flex min-h-13 items-center gap-3 px-4 text-[15px] font-semibold',
              index > 0 && 'border-t border-border-soft',
            )}
          >
            <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />
            <span className="truncate">{item.title}</span>
          </li>
        ))}
      </ul>
      <OutlineButton
        icon={ChevronDown}
        aria-expanded={choosing}
        onClick={() => {
          setChoosing((open) => !open)
        }}
        className="h-12 rounded-2xl font-display text-[15px] font-bold"
      >
        Mover las protegidas a…
      </OutlineButton>
      {choosing && (
        <ul aria-label="Mover a" className="flex flex-col gap-1">
          {destinations.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => {
                  moveAll(destination)
                }}
                className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] font-semibold outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ListIcon
                  name={destination.name}
                  color={destination.color}
                  icon={destination.icon}
                />
                <span className="truncate">{destination.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled
        className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-fill font-display text-base font-bold text-muted-foreground"
      >
        <Users aria-hidden className="size-[18px]" strokeWidth={2.2} />
        Invitar con un enlace
      </button>
    </>
  )
}
