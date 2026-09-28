import { Calendar, CircleCheck, Grid2x2Plus, ShoppingBag, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { CREATABLE_KINDS } from '../schemas'
import { KIND_TEMPLATES } from '../templates'
import type { ListKind } from '../types'

type CreatableKind = (typeof CREATABLE_KINDS)[number]

const OPTIONS: readonly { kind: ListKind; icon: LucideIcon }[] = [
  { kind: 'tasks', icon: CircleCheck },
  { kind: 'shopping', icon: ShoppingBag },
  { kind: 'events', icon: Calendar },
  { kind: 'custom', icon: Grid2x2Plus },
]

const isCreatable = (kind: ListKind): kind is CreatableKind =>
  (CREATABLE_KINDS as readonly ListKind[]).includes(kind)

interface KindPickerProps {
  value: CreatableKind
  onChange: (kind: CreatableKind) => void
  /** Con ítems el tipo no se puede cambiar (02 §Crear / editar lista). */
  locked?: boolean
}

/**
 * Cuatro tarjetas de tipo en rejilla 2 × 2 (diseño 04 Listas). «Personalizada» se ve pero no se
 * puede elegir hasta la 1.14 («Pronto»). Si la lista ya tiene ítems, todo se atenúa y se explica.
 */
export function KindPicker({ value, onChange, locked = false }: KindPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Tipo de lista"
        aria-disabled={locked || undefined}
        className={cn('grid grid-cols-2 gap-2.5', locked && 'opacity-55')}
      >
        {OPTIONS.map(({ kind, icon: Icon }) => {
          const template = KIND_TEMPLATES[kind]
          const selected = kind === value
          const soon = !isCreatable(kind)
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked || soon}
              onClick={() => {
                if (isCreatable(kind)) onChange(kind)
              }}
              className={cn(
                'relative flex flex-col gap-1.5 rounded-[18px] border bg-card p-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected
                  ? 'border-2 border-primary bg-brand-tint p-[13px]'
                  : 'border-border-soft enabled:hover:border-border enabled:hover:bg-fill/50',
                soon && 'opacity-60',
              )}
            >
              <Icon
                aria-hidden
                className={cn('size-[22px]', selected ? 'text-primary' : 'text-foreground')}
                strokeWidth={2}
              />
              <span
                className={cn(
                  'font-display text-sm font-bold',
                  selected ? 'text-primary-strong' : 'text-foreground',
                )}
              >
                {template.label}
              </span>
              <span
                className={cn(
                  'text-xs leading-[1.4]',
                  selected ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {template.description}
              </span>
              {soon && (
                <span className="absolute top-3 right-3 rounded-[7px] bg-fill px-2 py-[3px] text-[11px] font-bold text-subtle-foreground">
                  Pronto
                </span>
              )}
            </button>
          )
        })}
      </div>
      {locked && (
        <p className="-mt-1.5 text-[13px] leading-[1.4] text-subtle-foreground">
          El tipo no se puede cambiar: la lista ya tiene ítems.
        </p>
      )}
    </div>
  )
}
