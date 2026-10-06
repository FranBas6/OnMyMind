import { Users } from 'lucide-react'

import type { List } from '@/features/lists/types'
import { cn } from '@/lib/utils'

import { useListSharing } from '../hooks/useSharing'
import { withPeople } from '../copy'
import type { ListPerson } from '../schemas'
import { PersonInitial } from './PersonInitial'

const SIZES = {
  /** En la tarjeta de Inicio, junto al ··· (M1), y en el menú de quien entró (M3). */
  sm: 'size-[22px] text-[11px] ring-2 ring-card',
  /** En la cabecera del detalle (M2, D3). */
  md: 'size-[26px] text-xs ring-2 ring-background',
} as const

/** Las iniciales de quienes están en una lista, en círculos pequeños solapados (diseño 20). */
export function SharedInitials({
  people,
  size = 'sm',
  className,
}: {
  people: readonly ListPerson[]
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span aria-hidden className={cn('flex -space-x-1.5', className)}>
      {people.map((person) => (
        <PersonInitial
          key={person.userId}
          name={person.displayName}
          isOwner={person.isOwner}
          className={SIZES[size]}
        />
      ))}
    </span>
  )
}

/** Las iniciales de una tarjeta de Inicio, si la lista es compartida (M1). */
export function ListCardInitials({ list }: { list: List }) {
  const { shared, people } = useListSharing(list.id)
  if (!shared) return null
  return <SharedInitials people={people} className="mt-1" />
}

/** Lo mismo, dicho, tras el nombre de la tarjeta: «Compras, compartida con Marta». */
export function ListCardSharedNote({ list }: { list: List }) {
  const { shared, others } = useListSharing(list.id)
  if (!shared) return null
  return <span className="sr-only">, compartida {withPeople(others)}</span>
}

/** El icono de dos personas tras el nombre en el sidebar, si la lista es compartida (D3). */
export function SidebarSharedIcon({ list }: { list: List }) {
  const { shared } = useListSharing(list.id)
  if (!shared) return null
  return (
    <>
      <Users aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="sr-only">{' (compartida)'}</span>
    </>
  )
}

/**
 * Las iniciales de la cabecera del detalle (M2, D3): son el botón de «Quién está». En escritorio,
 * con borde, delante del ···.
 */
export function PeopleButton({
  list,
  isDesktop,
  onOpen,
}: {
  list: List
  isDesktop: boolean
  onOpen: () => void
}) {
  const { shared, people } = useListSharing(list.id)
  if (!shared) return null
  return (
    <button
      type="button"
      aria-label={list.isOwner ? `Compartir «${list.name}»` : `Quién está en «${list.name}»`}
      onClick={onOpen}
      className={cn(
        'flex h-11 items-center rounded-xl px-2 outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDesktop && 'border border-border-soft bg-card px-2.5',
      )}
    >
      <SharedInitials people={people} size="md" />
    </button>
  )
}

/** «👥 con Fran» tras el nombre de la lista en un grupo de Hoy (diseño 20, M6). */
export function SharedWith({ list }: { list: List }) {
  const { shared, others } = useListSharing(list.id)
  if (!shared) return null
  return (
    <span className="flex items-center gap-1 font-semibold tracking-normal normal-case">
      <Users aria-hidden className="size-3.5" strokeWidth={2} />
      {withPeople(others)}
    </span>
  )
}
