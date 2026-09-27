import { Archive, Pencil, Trash, type LucideIcon } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon } from '@/components/ListIcon'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { menuSummary } from '../templates'
import type { List } from '../types'
import { useListActions } from './listActionsContext'

interface ListCardMenuProps {
  list: List
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * `card`: el botón de 32 px con puntos en `control` de la tarjeta de Inicio. `header`: el de la
   * cabecera del detalle, de 44 px con puntos en `foreground` (6 px en móvil, 5 en escritorio).
   */
  variant?: 'card' | 'header'
}

/**
 * Menú ··· de una tarjeta (diseño 04 Listas): Editar, Archivar y Borrar. En escritorio, popover de
 * 200 px bajo el botón (D1); en móvil, hoja inferior con la lista en la cabecera (L3), que también
 * abre la pulsación larga.
 */
export function ListCardMenu({ list, open, onOpenChange, variant = 'card' }: ListCardMenuProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const actions = useListActions()
  const items: readonly MenuEntry[] = [
    {
      label: 'Editar',
      icon: Pencil,
      onSelect: () => {
        actions.openEdit(list)
      },
    },
    {
      label: 'Archivar',
      icon: Archive,
      onSelect: () => {
        actions.archive(list)
      },
    },
    {
      label: 'Borrar',
      icon: Trash,
      destructive: true,
      onSelect: () => {
        actions.confirmDelete(list)
      },
    },
  ]

  const trigger = (
    <DotsButton active={open} variant={variant} label={`Opciones de «${list.name}»`} />
  )

  if (isDesktop) {
    return (
      <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 w-[200px] rounded-2xl border border-border-soft bg-card p-1.5 text-foreground shadow-popover outline-none"
          >
            {items.map((item) => (
              <DropdownMenu.Item
                key={item.label}
                onSelect={item.onSelect}
                className={cn(rowClass(item, 'h-11'), 'data-highlighted:bg-fill')}
              >
                <item.icon aria-hidden className="size-[18px]" strokeWidth={2} />
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <>
      <DotsButton
        active={open}
        variant={variant}
        label={`Opciones de «${list.name}»`}
        onClick={() => {
          onOpenChange(true)
        }}
      />
      <BottomSheet open={open} onOpenChange={onOpenChange} title={`Opciones de «${list.name}»`}>
        <div className="flex items-center gap-3">
          <ListIcon name={list.name} color={list.color} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-extrabold tracking-[-0.02em]">
              {list.name}
            </p>
            <p className="text-[13px] text-muted-foreground">{menuSummary(list)}</p>
          </div>
        </div>
        <div className="-mx-2 flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onOpenChange(false)
                item.onSelect()
              }}
              className={cn(rowClass(item, 'h-13'), 'active:bg-fill')}
            >
              <item.icon aria-hidden className="size-[18px]" strokeWidth={2} />
              {item.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}

interface MenuEntry {
  label: string
  icon: LucideIcon
  destructive?: boolean
  onSelect: () => void
}

/** Filas del menú: la de Borrar, en rojo y tras un filete, algo más baja (48 px). */
function rowClass(item: MenuEntry, height: string) {
  return cn(
    'flex w-full cursor-default items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none select-none',
    item.destructive
      ? 'mt-1 h-12 rounded-none border-t border-border-soft pt-1 text-destructive'
      : [height, 'text-foreground [&_svg]:text-muted-foreground'],
  )
}

interface DotsButtonProps extends React.ComponentProps<'button'> {
  active: boolean
  variant: 'card' | 'header'
  label: string
}

/**
 * Botón ···. En la tarjeta: en reposo, puntos en `control`; con el menú abierto, fondo y puntos
 * oscuros. En la cabecera del detalle los puntos van siempre en `foreground` (pantalla 4, D1).
 */
function DotsButton({ active, variant, label, className, ...props }: DotsButtonProps) {
  const header = variant === 'header'
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex items-center justify-center outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
        header ? '-mr-2 size-11 gap-1 rounded-xl' : 'size-8 gap-[3px] rounded-[10px]',
        active && 'bg-fill',
        className,
      )}
      {...props}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={cn(
            'rounded-full',
            header ? 'size-1.5 bg-foreground md:size-[5px]' : 'size-1',
            !header && (active ? 'bg-foreground' : 'bg-control'),
          )}
        />
      ))}
    </button>
  )
}
