import { ListPlus, Plus } from 'lucide-react'

import { useListActions } from './listActionsContext'

/** Botón redondo de 44 px junto al avatar, en la cabecera de Inicio en móvil (diseño 04 Listas, L1). */
export function NewListRoundButton() {
  const { openCreate } = useListActions()
  return (
    <button
      type="button"
      aria-label="Nueva lista"
      onClick={openCreate}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
    >
      <ListPlus aria-hidden className="size-[22px]" strokeWidth={2.2} />
    </button>
  )
}

/** Botón «+ Nueva lista» de la cabecera de Inicio en escritorio (diseño 03 Inicio). */
export function NewListHeaderButton() {
  const { openCreate } = useListActions()
  return (
    <button
      type="button"
      onClick={openCreate}
      className="hidden h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold whitespace-nowrap outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:inline-flex"
    >
      <Plus aria-hidden className="size-4" />
      Nueva lista
    </button>
  )
}

/** Tarjeta punteada al final de la rejilla, solo en móvil (diseño 04 Listas, L1). */
export function NewListCard() {
  const { openCreate } = useListActions()
  return (
    <button
      type="button"
      onClick={openCreate}
      className="flex min-h-[150px] w-full flex-col items-center justify-center gap-2.5 rounded-[22px] border-[1.5px] border-dashed border-control p-4 text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="grid size-10 place-items-center rounded-[13px] bg-brand-tint">
        <Plus aria-hidden className="size-[18px]" strokeWidth={2.6} />
      </span>
      <span className="font-display text-sm font-bold">Nueva lista</span>
    </button>
  )
}

/** Acción del estado vacío (diseño 03 Inicio, D6). */
export function NewListEmptyButton() {
  const { openCreate } = useListActions()
  return (
    <button
      type="button"
      onClick={openCreate}
      className="h-12 rounded-[14px] bg-primary px-6 font-display text-[15px] font-bold text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Nueva lista
    </button>
  )
}
