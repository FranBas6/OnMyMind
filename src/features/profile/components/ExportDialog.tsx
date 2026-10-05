import { Check, Download, FileText } from 'lucide-react'
import { useState } from 'react'

import { FormError } from '@/features/auth'
import { InboxMark } from '@/features/capture'
import { useArchivedLists, useLists, type List } from '@/features/lists'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { exportableLists } from '../export'
import { useExportData } from '../hooks/useAccountData'
import { ProfileSheet } from './ProfileSheet'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
}

type Format = 'json' | 'csv'

const FORMATS: { value: Format; title: string; description: string }[] = [
  {
    value: 'json',
    title: 'JSON · todo',
    description:
      'Todas tus listas, sublistas, ítems, enlaces, precios y ajustes. Para guardarlo o llevártelo.',
  },
  {
    value: 'csv',
    title: 'CSV · una lista',
    description: 'Una lista como tabla, para abrirla en Numbers o Excel.',
  },
]

/**
 * «Exportar mis datos» (diseño 18, P7 y P8): JSON con todo o CSV de una lista, que se prepara en
 * el navegador y se descarga. En escritorio, en el diálogo de 440 px, que D5 no dibuja. Mientras se
 * prepara, «Exportando…»; si falla, la línea de error y se puede volver a probar.
 */
export function ExportDialog({ open, onOpenChange, isDesktop }: ExportDialogProps) {
  const exportData = useExportData()
  const lists = useLists()
  const archived = useArchivedLists()
  const [format, setFormat] = useState<Format>('json')
  const [listId, setListId] = useState<string | null>(null)

  const choices = exportableLists(lists.data?.inbox, lists.data?.lists ?? [], archived.data ?? [])
  // Por defecto, la primera de tus listas (o «En mente» si no hay otra).
  const chosen =
    choices.find((list) => list.id === listId) ??
    choices.find((list) => list.kind !== 'inbox') ??
    choices[0]

  const close = (next: boolean) => {
    if (!next) exportData.reset()
    onOpenChange(next)
  }
  const run = () => {
    const choice =
      format === 'json'
        ? { kind: 'json' as const }
        : chosen && { kind: 'csv' as const, list: chosen }
    if (!choice) return
    exportData.mutate(choice, {
      onSuccess: () => {
        close(false)
      },
    })
  }

  const label = exportData.isPending
    ? 'Exportando…'
    : format === 'csv' && chosen
      ? `Exportar ${chosen.name}`
      : 'Exportar'
  const cancel = (
    <button
      type="button"
      onClick={() => {
        close(false)
      }}
      className={cn(
        'font-display font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDesktop
          ? 'h-12 rounded-[14px] bg-fill px-5 text-[15px] text-foreground hover:bg-border'
          : 'rounded-md text-[15px] text-muted-foreground',
      )}
    >
      Cancelar
    </button>
  )

  return (
    <ProfileSheet
      open={open}
      onOpenChange={close}
      isDesktop={isDesktop}
      title="Exportar mis datos"
      headerAction={cancel}
    >
      <div role="radiogroup" aria-label="Qué exportar" className="flex flex-col gap-2.5">
        {FORMATS.map((option) => {
          const selected = option.value === format
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setFormat(option.value)
              }}
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected
                  ? 'border-primary bg-brand-tint text-primary-strong'
                  : 'border-border-soft bg-background hover:bg-fill',
              )}
            >
              <FileText
                aria-hidden
                className={cn(
                  'mt-0.5 size-[18px] shrink-0',
                  selected ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-display text-[15px] font-bold">{option.title}</span>
                <span
                  className={cn(
                    'text-[13px] leading-[1.45]',
                    selected ? 'text-primary-strong' : 'text-muted-foreground',
                  )}
                >
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {format === 'csv' && (
        <div>
          <p
            id="export-list-label"
            className="px-1 pb-2 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
          >
            Qué lista
          </p>
          <div
            role="radiogroup"
            aria-labelledby="export-list-label"
            className="max-h-[30dvh] overflow-y-auto rounded-2xl border border-border-soft bg-background"
          >
            {choices.map((list, index) => (
              <ListChoice
                key={list.id}
                list={list}
                archived={archived.data?.some((entry) => entry.id === list.id) ?? false}
                selected={list.id === chosen?.id}
                first={index === 0}
                onChoose={() => {
                  setListId(list.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {exportData.isError && (
        <FormError message="No se ha podido exportar. Prueba otra vez en un momento." />
      )}

      <div className={cn('flex flex-col gap-3', isDesktop && 'flex-row-reverse gap-2.5')}>
        <button
          type="button"
          disabled={exportData.isPending || (format === 'csv' && !chosen)}
          onClick={run}
          className={cn(
            'flex items-center justify-center gap-2 bg-primary font-display font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70',
            isDesktop ? 'h-12 rounded-[14px] px-[22px] text-[15px]' : 'h-13 rounded-2xl text-base',
          )}
        >
          <Download aria-hidden className="size-[18px]" strokeWidth={2.4} />
          {label}
        </button>
        {isDesktop && cancel}
      </div>
      <p
        className={cn(
          'px-1 text-[13px] leading-[1.45] text-muted-foreground',
          isDesktop && '-mt-1',
        )}
      >
        {format === 'json'
          ? 'Las fotos van como enlaces. Se descarga un archivo y lo guardas donde quieras.'
          : 'Las sublistas salen como filas con su nombre en la columna «Sublista».'}
      </p>
    </ProfileSheet>
  )
}

function ListChoice({
  list,
  archived,
  selected,
  first,
  onChoose,
}: {
  list: List
  archived: boolean
  selected: boolean
  first: boolean
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onChoose}
      className={cn(
        'flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] outline-none focus-visible:bg-fill',
        !first && 'border-t border-border-soft',
        selected ? 'bg-brand-tint' : 'hover:bg-fill',
      )}
    >
      {list.kind === 'inbox' ? (
        <InboxMark className="size-3.5" />
      ) : (
        <span
          aria-hidden
          className={cn('size-2.5 shrink-0 rounded-[3px]', LIST_COLOR_BG[list.color])}
        />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">
        {list.name}
        {archived && <span className="font-normal text-muted-foreground"> · archivada</span>}
      </span>
      {selected && <Check aria-hidden className="size-4 shrink-0 text-primary" strokeWidth={2.6} />}
    </button>
  )
}
