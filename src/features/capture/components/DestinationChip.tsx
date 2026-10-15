import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { destinationName, type Destination } from '@/features/items'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { parseListIcon } from '@/lib/listIcons'
import { cn } from '@/lib/utils'

/**
 * Chip de «Guardar en» (pantalla 3 y diseño 07): píldora de 36 px con el punto del color de la
 * lista sobre `fill`. «En mente» elegida va en `primary` con su símbolo. Una lista elegida va
 * rellena de su color con un check; el diseño pone el texto en blanco, pero sobre casi todos los
 * colores de lista no llega a AA (coral 3:1, ámbar 2,2:1): va en `foreground`, salvo el índigo.
 * Una sublista dice «Viajes › Lisboa», con la lista más suave (diseño 12, A4), en el color de su
 * lista como las demás (el diseño la pinta en índigo). Sin elegir, el cuadrado de la lista a 20 px;
 * elegida, su icono o su emoji sin cuadrado, y con la inicial, el check (diseño 28, L5).
 */
export function DestinationChip({
  destination,
  selected,
  onClick,
}: {
  destination: Destination
  selected: boolean
  onClick: () => void
}) {
  const { list, sublist } = destination
  const inbox = list.kind === 'inbox'
  const lightText = inbox || list.color === 'indigo'
  const glyph = parseListIcon(list.icon)

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={destinationName(destination)}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-[7px] rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !selected && 'bg-fill text-foreground hover:bg-border',
        selected && inbox && 'bg-primary text-primary-foreground',
        selected &&
          !inbox && [LIST_COLOR_BG[list.color], lightText ? 'text-white' : 'text-on-list'],
      )}
    >
      {inbox ? (
        <InboxMark className="size-3.5" light={selected} />
      ) : selected ? (
        glyph?.kind === 'icon' ? (
          <glyph.choice.icon aria-hidden className="size-3.5" strokeWidth={2.4} />
        ) : glyph?.kind === 'emoji' ? (
          <span aria-hidden className="text-[13px] leading-none">
            {glyph.emoji}
          </span>
        ) : (
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        )
      ) : (
        <ListIcon name={list.name} color={list.color} icon={list.icon} size="chip" />
      )}
      {sublist ? (
        <span aria-hidden>
          <span className="font-medium opacity-70">{list.name} › </span>
          {sublist.title}
        </span>
      ) : (
        list.name
      )}
    </button>
  )
}

/** El símbolo de «En mente»: índigo, o blanco sobre índigo. */
export function InboxMark({ className, light = false }: { className: string; light?: boolean }) {
  if (light) return <img src="/logos/svg/omm-mark-white.svg" alt="" className={className} />
  return (
    <>
      <img src="/logos/svg/omm-mark.svg" alt="" className={cn(className, 'dark:hidden')} />
      <img
        src="/logos/svg/omm-mark-dark.svg"
        alt=""
        className={cn(className, 'hidden dark:block')}
      />
    </>
  )
}

/** «···» de «Guardar en»: abre todas las listas (oscuro mientras están abiertas). */
export function MoreButton({
  active,
  className,
  ...props
}: ComponentProps<'button'> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-label="Otra lista"
      aria-expanded={active}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center gap-[3px] rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'bg-foreground text-background' : 'bg-fill text-foreground hover:bg-border',
        className,
      )}
      {...props}
    >
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="size-1 rounded-full bg-current" />
      ))}
    </button>
  )
}
