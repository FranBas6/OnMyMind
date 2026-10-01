import { Calendar, CircleCheck, ShoppingBag, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { CREATABLE_KINDS } from '../schemas'
import { KIND_TEMPLATES } from '../templates'

type CreatableKind = (typeof CREATABLE_KINDS)[number]

const OPTIONS: readonly { kind: CreatableKind; icon: LucideIcon }[] = [
  { kind: 'tasks', icon: CircleCheck },
  { kind: 'shopping', icon: ShoppingBag },
  { kind: 'events', icon: Calendar },
]

interface KindPickerProps {
  value: CreatableKind
  onChange: (kind: CreatableKind) => void
  /** La etiqueta visible del grupo («Tipo por defecto»). */
  labelledBy: string
}

/**
 * Tres tarjetas de tipo (diseño 04 Listas): en escritorio en una fila; en móvil, dos arriba y
 * Eventos debajo a todo el ancho. Es el tipo por defecto de la lista (diseño 12, T6): se puede
 * cambiar aunque tenga ítems, porque cada uno guarda el suyo. «Personalizada» ya no está: los campos
 * a medida se descartaron (ADR-011, decisión de Fran del 2026-10-01).
 */
export function KindPicker({ value, onChange, labelledBy }: KindPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-2.5 md:grid-cols-3"
    >
      {OPTIONS.map(({ kind, icon: Icon }) => {
        const template = KIND_TEMPLATES[kind]
        const selected = kind === value
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(kind)
            }}
            className={cn(
              'relative flex flex-col gap-1.5 rounded-[18px] border bg-card p-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              kind === 'events' && 'col-span-2 md:col-span-1',
              selected
                ? 'border-2 border-primary bg-brand-tint p-[13px]'
                : 'border-border-soft hover:border-border hover:bg-fill/50',
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
          </button>
        )
      })}
    </div>
  )
}
