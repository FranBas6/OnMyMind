import { Check, Pencil } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon } from '@/components/ListIcon'
import { LIST_COLOR_BG, LIST_COLOR_EMOJI, LIST_COLOR_RING, type ListColor } from '@/lib/listColors'
import {
  emojiValue,
  iconValue,
  LIST_EMOJIS,
  LIST_ICON_GROUPS,
  parseListIcon,
} from '@/lib/listIcons'
import { cn } from '@/lib/utils'

type Tab = 'icons' | 'emoji'

/** Columnas de la rejilla: 6, como los grupos (diseño 28, I2 y E1). */
const COLUMNS = 6

interface ListIconPickerProps {
  /** El nombre de la lista, para la inicial y «Icono de «Casa»». */
  name: string
  color: ListColor
  /** `lists.icon`: `null` es la inicial. */
  value: string | null
  onChange: (value: string | null) => void
  /** «Se guarda al crear la lista» o «al guardar la lista». */
  editing: boolean
  isDesktop: boolean
}

/**
 * El cuadrado del formulario de lista y su selector (5.9, diseño 28, I1–I6 y E1–E2): tocarlo (con
 * el lápiz pequeño en la esquina) abre una hoja en el móvil y un popover debajo en escritorio. Dos
 * pestañas, «Iconos» (8 grupos de 6) y «Emoji» (48), con «Inicial» primero. Lo elegido se ve al
 * momento en el formulario y se guarda con «Crear» o «Guardar»; «Listo» solo cierra. En
 * escritorio, las flechas se mueven por la rejilla, Intro elige (y cierra) y Esc cierra.
 */
export function ListIconPicker({
  name,
  color,
  value,
  onChange,
  editing,
  isDesktop,
}: ListIconPickerProps) {
  const [open, setOpen] = useState(false)
  const label = name.trim() ? `Icono de «${name.trim()}»` : 'Icono de la lista'

  const square = (
    <button
      type="button"
      aria-label={`${label}: elegir un icono o un emoji`}
      onClick={
        isDesktop
          ? undefined
          : () => {
              setOpen(true)
            }
      }
      className={cn(
        'relative shrink-0 rounded-[20px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        open && isDesktop && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
      )}
    >
      <ListIcon name={name} color={color} icon={value} size="form" />
      <span
        aria-hidden
        className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
      >
        <Pencil className="size-3" strokeWidth={2.4} />
      </span>
    </button>
  )

  if (isDesktop) {
    return (
      // Modal: el diálogo del formulario bloquea el scroll de lo que hay fuera de él, y el popover
      // va fuera (en un portal). Modal, el bloqueo activo es el suyo, que sí deja usar la rueda
      // dentro de la rejilla.
      <Popover.Root modal open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{square}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={12}
            aria-label={label}
            className="z-50 flex max-h-[min(440px,var(--radix-popover-content-available-height))] w-[420px] flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-4 text-foreground shadow-popover outline-none"
          >
            <PickerBody
              name={name}
              color={color}
              value={value}
              onChange={(next) => {
                onChange(next)
                setOpen(false)
              }}
            />
            <p className="-mb-1 text-center text-[11.5px] text-muted-foreground">
              Flechas para moverte · Intro elige · Esc cierra
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {square}
      <BottomSheet open={open} onOpenChange={setOpen} title={label} className="max-h-[88dvh]">
        <div className="flex items-center gap-3">
          <ListIcon name={name} color={color} icon={value} size="sm" className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight font-extrabold tracking-[-0.02em]">
              {label}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {editing ? 'Se guarda al guardar la lista' : 'Se guarda al crear la lista'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
            }}
            className="h-9 shrink-0 rounded-lg px-1 text-[15px] font-bold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Listo
          </button>
        </div>
        <PickerBody name={name} color={color} value={value} onChange={onChange} />
      </BottomSheet>
    </>
  )
}

/** Las pestañas, «Inicial» y la rejilla. */
function PickerBody({
  name,
  color,
  value,
  onChange,
}: Pick<ListIconPickerProps, 'name' | 'color' | 'value' | 'onChange'>) {
  const glyph = parseListIcon(value)
  const [tab, setTab] = useState<Tab>(glyph?.kind === 'emoji' ? 'emoji' : 'icons')
  const grid = useRef<HTMLDivElement>(null)

  // Las flechas se mueven por las celdas: «Inicial» va antes de la primera fila.
  const onKeyDown = (event: KeyboardEvent) => {
    const cells = [...(grid.current?.querySelectorAll<HTMLButtonElement>('[data-cell]') ?? [])]
    const index = cells.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: index === 0 ? 1 : COLUMNS,
      ArrowUp: index <= COLUMNS ? -index : -COLUMNS,
    }
    const delta = step[event.key]
    if (delta === undefined) return
    event.preventDefault()
    cells[Math.min(cells.length - 1, Math.max(0, index + delta))]?.focus()
  }

  return (
    <div ref={grid} onKeyDown={onKeyDown} className="flex min-h-0 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Qué poner"
        className="flex shrink-0 rounded-[14px] bg-fill p-1"
      >
        {(
          [
            ['icons', 'Iconos'],
            ['emoji', 'Emoji'],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
            }}
            className={cn(
              'h-9 flex-1 rounded-[11px] text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              tab === id
                ? 'bg-card font-bold text-foreground shadow-sm'
                : 'font-semibold text-muted-foreground hover:text-foreground',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label={tab === 'icons' ? 'Iconos' : 'Emoji'}
        className="-mx-1.5 flex min-h-0 flex-col gap-3 overflow-y-auto px-1.5 pt-1 pb-1.5"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            data-cell
            onClick={() => {
              onChange(null)
            }}
            className={cn(
              'flex h-12 shrink-0 items-center gap-2 rounded-[14px] py-1.5 pr-3 pl-1.5 text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              value === null
                ? [
                    LIST_COLOR_BG[color],
                    LIST_COLOR_RING[color],
                    'text-white ring-2 ring-offset-2 ring-offset-card',
                  ]
                : 'bg-fill text-foreground hover:bg-border',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-9 place-items-center rounded-[10px] font-display text-[17px] font-extrabold',
                value === null ? 'bg-white/25' : 'bg-card',
              )}
            >
              {name.trim().charAt(0).toUpperCase() || '·'}
            </span>
            Inicial
            {value === null && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
          </button>
          <p className="text-[13px] leading-[1.35] text-muted-foreground">
            La letra del nombre, como hasta ahora.
          </p>
        </div>

        {tab === 'icons' ? (
          LIST_ICON_GROUPS.map((group) => (
            <Group key={group.label} label={group.label}>
              {group.icons.map((icon) => {
                const selected = value === iconValue(icon.name)
                return (
                  <Cell
                    key={icon.name}
                    label={icon.label}
                    selected={selected}
                    className={
                      selected
                        ? [
                            LIST_COLOR_BG[color],
                            LIST_COLOR_RING[color],
                            'text-white ring-2 ring-offset-2 ring-offset-card',
                          ]
                        : 'text-foreground'
                    }
                    onSelect={() => {
                      onChange(iconValue(icon.name))
                    }}
                  >
                    <icon.icon aria-hidden className="size-[22px]" strokeWidth={2} />
                  </Cell>
                )
              })}
            </Group>
          ))
        ) : (
          <Group label="48 emoji">
            {LIST_EMOJIS.map((emoji) => {
              const selected = value === emojiValue(emoji)
              return (
                <Cell
                  key={emoji}
                  label={emoji}
                  selected={selected}
                  className={
                    selected
                      ? [LIST_COLOR_EMOJI[color], LIST_COLOR_RING[color], 'ring-2 ring-inset']
                      : ''
                  }
                  onSelect={() => {
                    onChange(emojiValue(emoji))
                  }}
                >
                  <span aria-hidden className="text-[24px] leading-none">
                    {emoji}
                  </span>
                </Cell>
              )
            })}
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p
        aria-hidden
        className="px-1 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        {label}
      </p>
      <div className="grid grid-cols-6 gap-2">{children}</div>
    </div>
  )
}

function Cell({
  label,
  selected,
  className,
  onSelect,
  children,
}: {
  label: string
  selected: boolean
  className: string | (string | false)[]
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-cell
      onClick={onSelect}
      className={cn(
        'grid h-12 place-items-center rounded-[14px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !selected && 'bg-fill hover:bg-border',
        className,
      )}
    >
      {children}
    </button>
  )
}
