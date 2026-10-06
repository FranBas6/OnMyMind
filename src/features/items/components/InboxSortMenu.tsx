import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  GripVertical,
  type LucideIcon,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { cn } from '@/lib/utils'

import { SORT_OPTIONS, type SortOrder } from '../filters'

const ICONS: Record<SortOrder, LucideIcon> = {
  newest: ArrowDownWideNarrow,
  oldest: ArrowUpWideNarrow,
  manual: GripVertical,
}

/**
 * Cómo se ordena «En mente» (diseño 14, E2, E5 y D7): el botón junto a los filtros abre un menú
 * con «Más reciente primero», «Más antigua primero» y «A mi manera» («Arrastra para ordenar»). El
 * icono cambia con la opción y, con «A mi manera», va en índigo: el orden es tuyo. En escritorio
 * lleva además el texto corto («Más reciente»). Antes (diseño 05) alternaba entre las dos fechas.
 */
export function InboxSortMenu({
  value,
  onChange,
}: {
  value: SortOrder
  onChange: (value: SortOrder) => void
}) {
  const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0]
  const Icon = ICONS[value]
  const manual = value === 'manual'

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Ordenar: ${current?.label ?? ''}`}
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold whitespace-nowrap outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-primary md:w-auto md:px-3',
            manual ? 'border-primary bg-brand-tint text-primary' : 'border-border bg-card',
          )}
        >
          <Icon
            aria-hidden
            className={cn('size-4 md:size-3.5', manual ? 'text-primary' : 'text-muted-foreground')}
            strokeWidth={2.2}
          />
          <span aria-hidden className="hidden md:inline">
            {current?.short}
          </span>
          <ChevronDown
            aria-hidden
            className="hidden size-3.5 text-muted-foreground md:block"
            strokeWidth={2.2}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[268px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
        >
          <DropdownMenu.Label className="px-2.5 pt-2 pb-1.5 font-sans text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            Ordenar
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(next) => {
              const option = SORT_OPTIONS.find((entry) => entry.value === next)
              if (option) onChange(option.value)
            }}
          >
            {SORT_OPTIONS.map((option) => {
              const OptionIcon = ICONS[option.value]
              const selected = option.value === value
              return (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium outline-none select-none data-highlighted:bg-fill',
                    selected && 'bg-brand-tint text-primary data-highlighted:bg-brand-tint',
                  )}
                >
                  <OptionIcon
                    aria-hidden
                    className={cn('size-4 shrink-0', !selected && 'text-muted-foreground')}
                    strokeWidth={2.2}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    {option.label}
                    {option.value === 'manual' && (
                      <span className="text-xs font-normal text-subtle-foreground">
                        Arrastra para ordenar
                      </span>
                    )}
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden className="size-4" strokeWidth={2.6} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              )
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
