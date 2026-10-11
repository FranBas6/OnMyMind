import { Link } from '@tanstack/react-router'
import { Check, ChevronLeft, CircleDot } from 'lucide-react'
import type { ReactNode } from 'react'

import type { List } from '@/features/lists'

import type { Item } from '../types'
import { useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { ItemTitleField } from './ItemTextFields'
import { SublistIcon } from './SublistIcon'

interface SublistHeaderProps {
  sublist: Item
  list: List
  /** «5 pendientes · 2 hechas · En curso» o «Sublista de Viajes». */
  summary: string
  /** Entrar con el nombre listo para editar («Renombrar»): cada valor nuevo lo vuelve a enfocar. */
  renameKey: number | undefined
  onRename: (title: string) => void
  /** El total de sus compras pendientes, a la derecha del nombre (diseño 16, A3). */
  total?: ReactNode
  /**
   * En una «para elegir una» (diseño 24, A2 y A4b), en vez del total, una línea debajo con lo que
   * cuenta en su lista («Cuenta en Compras · 199 €») o lo que se pagó («Pagaste · 199 €»).
   */
  counts?: { label: string; amount: string } | null
}

/**
 * Cabecera de la pantalla de una sublista (diseño 12, S2, S3 y D5): «‹ Viajes» para volver a su
 * lista, el icono de sublista en el color heredado y el nombre, que se edita ahí mismo (así es
 * «Renombrar», decisión de Fran). El ··· abre su menú, el mismo que el de su fila: una hoja en
 * móvil y un popover a la derecha del título en escritorio.
 */
export function SublistHeader({
  sublist,
  list,
  summary,
  renameKey,
  onRename,
  total,
  counts,
}: SublistHeaderProps) {
  const actions = useItemActions()
  const menuLabel = `Opciones de «${sublist.title}»`
  // «Para elegir una»: el círculo con punto delante de «2 opciones · desde 199 €»; hecha, el check.
  const SummaryIcon = sublist.chooseOne
    ? sublist.status === 'done' && sublist.chosenId
      ? Check
      : CircleDot
    : null

  return (
    <header className="flex flex-col gap-3">
      <div className="flex h-11 items-center justify-between">
        <Link
          to="/lists/$listId"
          params={{ listId: list.id }}
          className="-ml-1 flex h-11 min-w-0 items-center gap-1 self-start pr-2 text-[15px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronLeft aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
          <span className="truncate">{list.name}</span>
        </Link>
        {!actions.isDesktop && (
          <button
            type="button"
            aria-label={menuLabel}
            onClick={() => {
              actions.openMenu(sublist)
            }}
            className="-mr-2 flex size-11 items-center justify-center gap-1 rounded-xl outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-1.5 rounded-full bg-foreground" />
            ))}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-3.5 md:gap-4">
          <SublistIcon
            color={list.color}
            size="header"
            state={sublist.status === 'paused' ? 'paused' : 'active'}
          />
          <div className="min-w-0 flex-1">
            <h1 className="flex">
              <ItemTitleField
                key={`${sublist.id}-${String(renameKey ?? 0)}`}
                title={sublist.title}
                done={false}
                selectOnMount={renameKey !== undefined}
                label="Nombre de la sublista"
                onSave={onRename}
                className="text-[28px] leading-[1.1] tracking-[-0.03em] md:text-[32px]"
              />
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground md:text-sm">
              {SummaryIcon && (
                <SummaryIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.4} />
              )}
              <span className="min-w-0">{summary}</span>
            </p>
          </div>
        </div>
        {total}
        {actions.isDesktop && <ItemRowDotsMenu item={sublist} variant="header" />}
      </div>

      {counts && (
        <p className="flex items-baseline justify-between gap-3 px-1">
          <span className="text-[15px] text-muted-foreground">{counts.label}</span>
          <span className="font-display text-xl font-extrabold tracking-[-0.02em] whitespace-nowrap">
            {counts.amount}
          </span>
        </p>
      )}
    </header>
  )
}
