import { Archive, CopyPlus, LogOut, Pencil, Trash, Users, type LucideIcon } from 'lucide-react'
import { ContextMenu, DropdownMenu } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { SublistGlyph } from '@/components/SublistGlyph'
import { ListIcon } from '@/components/ListIcon'
import { personName } from '@/features/sharing/copy'
import { SharedInitials } from '@/features/sharing/components/SharedInitials'
import { useListPeople } from '@/features/sharing/hooks/useSharing'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { menuSummary } from '../templates'
import type { List } from '../types'
import type { ListPerson } from '@/features/sharing/schemas'

import { useListActions, type ListActions } from './listActionsContext'

interface ListCardMenuProps {
  list: List
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * `card`: el botón de 32 px con puntos en `control` de la tarjeta de Inicio. `header`: el de la
   * cabecera del detalle, de 44 px con puntos en `foreground` (6 px en móvil, 5 en escritorio).
   */
  variant?: 'card' | 'header'
  /** «Nueva sublista», la primera opción en la cabecera de su detalle (diseño 12, S7). */
  onNewSublist?: () => void
}

/**
 * Menú ··· de una tarjeta (diseño 04 Listas): Editar, Compartir (diseño 20, S1 y D1), Duplicar
 * (diseño 23, C1), Archivar y Borrar; en la cabecera del detalle, antes, «Nueva sublista» (diseño
 * 12, S7). En una lista compartida contigo, «Quién está», «Duplicar» (C4) y «Salir de la lista»,
 * con una nota de que el resto es cosa de quien la creó (M3 y D4). En escritorio, popover de 200 px bajo el botón (D1); en móvil,
 * hoja inferior con la lista en la cabecera (L3), que también abre la pulsación larga.
 */
export function ListCardMenu({
  list,
  open,
  onOpenChange,
  variant = 'card',
  onNewSublist,
}: ListCardMenuProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { items, shared, owner } = useMenuEntries(list, open, isDesktop, onNewSublist)
  const ownerName = personName(owner?.displayName)
  const memberNote = shared
    ? `Cambiar el nombre, el color o invitar a alguien es cosa de ${owner ? ownerName : 'quien creó la lista'}${owner ? ', que creó la lista' : ''}.`
    : null

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
                <item.icon
                  aria-hidden
                  className={cn('size-[18px]', item.iconClassName)}
                  strokeWidth={2}
                />
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
            <p className="text-[13px] text-muted-foreground">
              {shared
                ? owner
                  ? `De ${ownerName} · compartida contigo`
                  : 'Compartida contigo'
                : menuSummary(list)}
            </p>
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
              <item.icon
                aria-hidden
                className={cn('size-[18px]', item.iconClassName)}
                strokeWidth={2}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {item.trailing}
            </button>
          ))}
        </div>
        {memberNote && (
          <p className="-mt-1 text-[13px] leading-[1.45] text-muted-foreground">{memberNote}</p>
        )}
      </BottomSheet>
    </>
  )
}

/** Lo que lleva el menú de una lista, según sea tuya o compartida contigo. */
function useMenuEntries(
  list: List,
  open: boolean,
  isDesktop: boolean,
  onNewSublist?: () => void,
): { items: readonly MenuEntry[]; shared: boolean; owner: ListPerson | undefined } {
  const actions = useListActions()
  const shared = !list.isOwner
  // Quién está, para la cabecera y las iniciales del menú de quien entró (M3).
  const people = useListPeople(list.id, shared && open)
  const owner = people.data?.find((person) => person.isOwner)
  const items: readonly MenuEntry[] = [
    ...(onNewSublist
      ? [{ label: 'Nueva sublista', icon: SublistGlyph, accent: true, onSelect: onNewSublist }]
      : []),
    // Editar, compartir, archivar y borrar son de quien creó la lista (3.2, decisión 2).
    ...(shared
      ? memberEntries(list, actions, people.data, isDesktop)
      : ownerEntries(list, actions, isDesktop)),
  ]
  return { items, shared, owner }
}

/**
 * El mismo menú con el botón derecho sobre una lista del sidebar (diseño 23, E4): el sidebar no
 * tiene ···, y en escritorio el menú contextual es lo esperable. Se abre donde está el ratón.
 */
export function ListContextMenu({ list, children }: { list: List; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { items } = useMenuEntries(list, open, true)
  return (
    <ContextMenu.Root onOpenChange={setOpen} modal={false}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          aria-label={`Opciones de «${list.name}»`}
          className="z-50 w-[200px] rounded-2xl border border-border-soft bg-card p-1.5 text-foreground shadow-popover outline-none"
        >
          {items.map((item) => (
            <ContextMenu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(rowClass(item, 'h-11'), 'data-highlighted:bg-fill')}
            >
              <item.icon
                aria-hidden
                className={cn('size-[18px]', item.iconClassName)}
                strokeWidth={2}
              />
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function ownerEntries(list: List, actions: ListActions, isDesktop: boolean): MenuEntry[] {
  return [
    {
      label: 'Editar',
      icon: Pencil,
      onSelect: () => {
        actions.openEdit(list)
      },
    },
    // «En mente» no se comparte nunca.
    ...(list.kind === 'inbox'
      ? []
      : [
          {
            label: isDesktop ? 'Compartir…' : 'Compartir',
            icon: Users,
            iconClassName: 'text-primary',
            onSelect: () => {
              actions.openPeople(list)
            },
          },
          duplicateEntry(list, actions, isDesktop),
        ]),
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
}

/** «Duplicar», después de «Compartir» o «Quién está» (diseño 23, C1, C4 y E4). */
function duplicateEntry(list: List, actions: ListActions, isDesktop: boolean): MenuEntry {
  return {
    label: isDesktop ? 'Duplicar…' : 'Duplicar',
    icon: CopyPlus,
    onSelect: () => {
      actions.duplicate(list)
    },
  }
}

function memberEntries(
  list: List,
  actions: ListActions,
  people: readonly ListPerson[] | undefined,
  isDesktop: boolean,
): MenuEntry[] {
  return [
    {
      label: 'Quién está',
      icon: Users,
      trailing: people && <SharedInitials people={people} />,
      onSelect: () => {
        actions.openPeople(list)
      },
    },
    duplicateEntry(list, actions, isDesktop),
    {
      label: 'Salir de la lista',
      icon: LogOut,
      destructive: true,
      onSelect: () => {
        actions.openPeople(list, { confirmLeave: true })
      },
    },
  ]
}

interface MenuEntry {
  label: string
  icon: LucideIcon
  /** El icono de «Compartir», en índigo (S1). */
  iconClassName?: string
  /** A la derecha, en la hoja de móvil: las iniciales de «Quién está» (M3). */
  trailing?: ReactNode
  destructive?: boolean
  /** «Nueva sublista»: en índigo y con un filete debajo que la separa del resto (S7). */
  accent?: boolean
  onSelect: () => void
}

/** Filas del menú: la de Borrar, en rojo y tras un filete, algo más baja (48 px). */
function rowClass(item: MenuEntry, height: string) {
  return cn(
    'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none select-none',
    item.destructive
      ? 'mt-1 h-12 rounded-none border-t border-border-soft pt-1 text-destructive'
      : item.accent
        ? [height, 'mb-1 rounded-b-none border-b border-border-soft text-primary-strong']
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
