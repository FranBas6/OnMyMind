import { ChevronRight } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import { changeKindPatch, KIND_LABELS, kindChangeNotice, type ChoosableKind } from '../kind'
import type { Item, ItemPatch } from '../types'
import { KindOptions } from './KindOptions'
import { KIND_ICONS } from './kindIcons'

interface KindFieldProps {
  item: Item & { kind: ChoosableKind }
  isDesktop: boolean
  onChange: (patch: ItemPatch) => void
}

/**
 * Fila «Tipo» del detalle (diseño 12, T4 y D3), con el aspecto de «Fecha límite»: el tipo con su
 * icono a la derecha y el chevron. Abre los tipos (hoja apilada en móvil, popover bajo la fila en
 * escritorio); al elegir otro sale el aviso de lo que se pierde y cómo queda el estado, y el
 * cambio no se hace hasta «Cambiar a Compra». Se guarda de una vez (`changeKindPatch`).
 */
export function KindField({ item, isDesktop, onChange }: KindFieldProps) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<ChoosableKind>(item.kind)
  const Icon = KIND_ICONS[item.kind]

  const openWith = (next: boolean) => {
    if (next) setChoice(item.kind)
    setOpen(next)
  }
  const confirm = () => {
    if (choice !== item.kind) onChange(changeKindPatch(item, choice))
    setOpen(false)
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
  const notice = changed ? kindChangeNotice(item, choice) : null
  const body = (compact: boolean) => (
    <>
      <KindOptions label="Tipo del ítem" value={choice} compact={compact} onChange={setChoice} />
      {notice && (
        <p
          role="status"
          className={cn(
            'mx-1.5 font-semibold',
            compact
              ? 'mt-1.5 rounded-xl px-3 py-2.5 text-[13px] leading-[1.4]'
              : 'mt-2.5 rounded-[14px] px-3.5 py-3 text-[13.5px] leading-[1.4]',
            notice.losesSomething ? 'bg-warning-bg text-warning' : 'bg-fill text-muted-foreground',
          )}
        >
          {notice.text}
        </p>
      )}
      <div className={cn('mx-1.5 flex', compact ? 'mt-2.5 mb-1 gap-2' : 'mt-3.5 gap-2.5')}>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
          }}
          className={cn(
            'flex-1 bg-fill font-display font-bold outline-none hover:bg-border-soft focus-visible:ring-[3px] focus-visible:ring-ring/50',
            compact ? 'h-10 rounded-xl text-[13px]' : 'h-13 rounded-2xl text-[15px]',
          )}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!changed}
          onClick={confirm}
          className={cn(
            'flex-[1.4] bg-primary font-display font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 disabled:hover:bg-primary',
            compact ? 'h-10 rounded-xl text-[13px]' : 'h-13 rounded-2xl text-[15px]',
          )}
        >
          {changed ? `Cambiar a ${KIND_LABELS[choice]}` : 'Elige un tipo'}
        </button>
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <Popover.Root open={open} onOpenChange={openWith}>
        <Popover.Anchor asChild>{row}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            aria-label="Tipo del ítem"
            className="z-50 flex w-80 flex-col gap-0.5 rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
          >
            {body(true)}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {row}
      <BottomSheet
        nested
        open={open}
        onOpenChange={openWith}
        title="Tipo del ítem"
        className="px-4"
      >
        <div className="flex items-baseline justify-between gap-3 px-3.5 pt-1 pb-2">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Tipo del ítem</p>
          <p className="truncate text-[13px] text-subtle-foreground">{item.title}</p>
        </div>
        {body(false)}
      </BottomSheet>
    </>
  )
}
