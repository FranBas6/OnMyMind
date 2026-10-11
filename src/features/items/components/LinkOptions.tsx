import type { LucideIcon } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

export interface LinkOption {
  id: string
  label: string
  icon: LucideIcon
  run: () => void
  destructive?: boolean
}

interface LinkOptionsProps {
  /** El nombre de la tienda o el título del enlace: título de la hoja y de su botón. */
  name: string
  /** La línea gris de debajo del nombre, en la hoja del móvil. */
  summary: string
  options: readonly LinkOption[]
  isDesktop: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Tocar una fila de «Dónde comprarlo» (diseño 19, T3) o de «Enlaces» (4.6) abre sus opciones: en
 * el móvil una hoja con el nombre, en escritorio un menú junto a la fila. El botón cubre la fila
 * entera (`absolute inset-0`); lo que deba seguir tocándose encima va con `relative z-10`.
 */
export function LinkOptions({
  name,
  summary,
  options,
  isDesktop,
  open,
  onOpenChange,
}: LinkOptionsProps) {
  const trigger = (
    <button
      type="button"
      aria-label={`${name}: opciones`}
      className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      onClick={
        isDesktop
          ? undefined
          : () => {
              onOpenChange(true)
            }
      }
    />
  )

  if (isDesktop) {
    return (
      <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 w-[220px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
          >
            {options.map((entry) => (
              <DropdownMenu.Item
                key={entry.id}
                onSelect={entry.run}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none select-none data-highlighted:bg-fill',
                  entry.destructive &&
                    'mt-1 rounded-none border-t border-border-soft pt-1 text-destructive',
                )}
              >
                <entry.icon aria-hidden className="size-4" strokeWidth={2} />
                {entry.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <>
      {trigger}
      <BottomSheet nested open={open} onOpenChange={onOpenChange} title={name}>
        <div>
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{name}</p>
          <p className="mt-0.5 text-[13px] text-subtle-foreground">{summary}</p>
        </div>
        <div className="-mx-2 flex flex-col gap-0.5">
          {options.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                onOpenChange(false)
                entry.run()
              }}
              className={cn(
                'flex h-13 w-full items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none active:bg-fill',
                entry.destructive ? 'text-destructive' : 'text-foreground',
              )}
            >
              <entry.icon aria-hidden className="size-[18px]" strokeWidth={2} />
              {entry.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}
