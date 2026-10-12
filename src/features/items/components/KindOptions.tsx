import { Check, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  CHOOSABLE_KINDS,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  KIND_PREFIX_LABELS,
  type AddableKind,
} from '../kind'
import { KIND_ICONS } from './kindIcons'

interface KindOptionsProps<K extends AddableKind> {
  /** El tipo marcado. */
  value: K
  onChange: (kind: K) => void
  /** Los que se ofrecen; «Sublista» va al final, tras un filete (diseño 12, T2). */
  kinds?: readonly K[]
  /**
   * Las filas de 44 px del popover de escritorio, con el prefijo de cada tipo a la derecha en vez
   * de su descripción (diseño 25, D3); sin él, las de 56 px de la hoja de móvil (B5c).
   */
  compact?: boolean
  /** En el popover, el prefijo de cada tipo («[ ] », «> »…) a la derecha (D3). */
  prefixes?: boolean
  label: string
}

/**
 * Los tipos para elegir (diseño 25, B5c, B6 y D3): el icono de cada uno sin caja, su nombre y, en
 * la hoja, lo que trae («Casilla, prioridad, fecha y aviso»). El marcado va en `brand-tint`, con el
 * nombre y la descripción en `primary-strong` y el check a la derecha.
 */
export function KindOptions<K extends AddableKind>({
  value,
  onChange,
  kinds = CHOOSABLE_KINDS as readonly AddableKind[] as readonly K[],
  compact = false,
  prefixes = false,
  label,
}: KindOptionsProps<K>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
      {kinds.map((kind) => {
        const Icon: LucideIcon = KIND_ICONS[kind]
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
              'relative flex shrink-0 items-center text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              kind === 'sublist' &&
                'mt-3 before:absolute before:inset-x-3 before:-top-2 before:h-px before:bg-border-soft before:content-[""]',
              compact ? 'h-11 gap-3 rounded-[10px] px-2.5' : 'min-h-14 gap-3.5 rounded-[14px] px-3',
              selected ? 'bg-brand-tint' : 'hover:bg-fill/60',
              selected ? 'text-primary-strong' : 'text-foreground',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 justify-center',
                compact ? 'w-5' : 'w-6',
                !selected && 'text-muted-foreground',
              )}
            >
              <Icon
                aria-hidden
                className={kind === 'sublist' ? 'size-4' : 'size-[18px]'}
                strokeWidth={kind === 'sublist' ? 3 : 2.2}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block',
                  compact ? 'text-[14.5px]' : 'text-base',
                  selected ? 'font-semibold' : 'font-medium',
                )}
              >
                {KIND_LABELS[kind]}
              </span>
              {!compact && (
                <span
                  className={cn(
                    'block text-[13px]',
                    selected ? 'text-primary-strong' : 'text-muted-foreground',
                  )}
                >
                  {KIND_DESCRIPTIONS[kind]}
                </span>
              )}
            </span>
            {prefixes && (
              <span className="shrink-0 font-mono text-xs whitespace-nowrap text-subtle-foreground">
                {KIND_PREFIX_LABELS[kind]}
              </span>
            )}
            <span className={cn('flex shrink-0 justify-end', compact ? 'w-3.5' : 'w-[18px]')}>
              {selected && (
                <Check
                  aria-hidden
                  className={compact ? 'size-3.5' : 'size-[18px]'}
                  strokeWidth={3}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
