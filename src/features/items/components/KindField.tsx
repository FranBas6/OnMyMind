import { ChevronRight } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
// Por su ruta y no por el índice: `reminders` usa piezas de `items`.
import { useItemReminder } from '@/features/reminders/hooks/useReminders'
import { cn } from '@/lib/utils'

import { KIND_LABELS, kindChangeNotice, type ChoosableKind } from '../kind'
import type { Item } from '../types'
import { KindOptions } from './KindOptions'
import { KIND_ICONS } from './kindIcons'

interface KindFieldProps {
  item: Item & { kind: ChoosableKind }
  isDesktop: boolean
  /** Cambia el tipo de una vez (`changeKindPatch`), con «Ahora es una tarea · Deshacer». */
  onChange: (kind: ChoosableKind) => void
}

/**
 * Fila «Tipo» de la ficha (diseño 12, T4 y D3; diseño 25, B2d y B6), con el aspecto de «Fecha
 * límite»: el tipo con su icono a la derecha y el chevron. Abre los tipos y, al elegir otro, una
 * caja dice lo que pasa: con el texto («"Vuelo a Lisboa" será el título y el resto, sus notas»), lo
 * que se pierde, en negrita, y el estado. En el móvil, una hoja «Tipo» y «Listo» cambia (B6); en
 * escritorio, un popover bajo la fila con «Cancelar» y «Cambiar a Tarea».
 */
export function KindField({ item, isDesktop, onChange }: KindFieldProps) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<ChoosableKind>(item.kind)
  const reminder = useItemReminder(item.id) !== undefined
  const Icon = KIND_ICONS[item.kind]

  const openWith = (next: boolean) => {
    if (next) setChoice(item.kind)
    setOpen(next)
  }
  const confirm = () => {
    setOpen(false)
    if (choice !== item.kind) onChange(choice)
  }

  const row = (
    <button
      type="button"
      onClick={() => {
        openWith(true)
      }}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card px-4 text-[15px] outline-none hover:border-border hover:bg-fill/50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        open && isDesktop && 'border-primary bg-brand-tint hover:bg-brand-tint',
      )}
    >
      <span className="font-medium">Tipo</span>
      <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="size-[15px] text-muted-foreground" strokeWidth={2.2} />
          {KIND_LABELS[item.kind]}
        </span>
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )

  const changed = choice !== item.kind
  const notice = changed ? kindChangeNotice(item, choice, { reminder }) : null
  const noticeBox = notice && (
    <p
      role="status"
      className={cn(
        'rounded-[14px] bg-fill leading-[1.45]',
        isDesktop ? 'mx-1 mt-1.5 px-3 py-2.5 text-[13px]' : 'mt-1.5 px-3.5 py-3 text-sm',
      )}
    >
      {notice.lead && <>{notice.lead} </>}
      {notice.lost && <b className="font-bold">{notice.lost}</b>}
      {notice.lost && ' '}
      {notice.rest}
    </p>
  )
  const options = (
    <KindOptions label="Tipo" value={choice} compact={isDesktop} onChange={setChoice} />
  )

  if (isDesktop) {
    return (
      <Popover.Root open={open} onOpenChange={openWith}>
        <Popover.Anchor asChild>{row}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            aria-label="Tipo"
            className="z-50 flex w-80 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
          >
            {options}
            {noticeBox}
            <div className="mx-1 mt-2.5 mb-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                }}
                className="h-10 flex-1 rounded-xl bg-fill font-display text-[13px] font-bold outline-none hover:bg-border-soft focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!changed}
                onClick={confirm}
                className="h-10 flex-[1.4] rounded-xl bg-primary font-display text-[13px] font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 disabled:hover:bg-primary"
              >
                {changed ? `Cambiar a ${KIND_LABELS[choice]}` : 'Elige un tipo'}
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {row}
      <BottomSheet nested open={open} onOpenChange={openWith} title="Tipo" className="gap-1.5">
        <div className="flex h-11 items-center justify-between px-1">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Tipo</p>
          <button
            type="button"
            onClick={confirm}
            className="rounded-md text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Listo
          </button>
        </div>
        {options}
        {noticeBox}
      </BottomSheet>
    </>
  )
}
