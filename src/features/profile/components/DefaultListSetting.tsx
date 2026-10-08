import { Check, ChevronRight, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon } from '@/components/ListIcon'
import { InboxMark } from '@/features/capture'
import { KIND_TEMPLATES, useArchivedLists, useLists, type List } from '@/features/lists'
import { shortcutKey } from '@/lib/device'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { useProfile } from '../hooks/useProfile'
import { useUpdateSettings } from '../hooks/useProfileMutations'

/**
 * «Lista por defecto» de «Captura» (diseño 09, P6, P7 y D4): dónde cae lo que capturas sin
 * elegir lista. En móvil abre la hoja de «Todas las listas»; en escritorio, el popover con
 * buscador bajo la fila. «En mente» va siempre primera y las archivadas no salen. Si la elegida
 * se archiva o se borra, la captura vuelve a «En mente» sin preguntar y aquí sale una línea que
 * lo cuenta; se va al tocar la fila.
 */
export function DefaultListSetting({ isDesktop }: { isDesktop: boolean }) {
  const profile = useProfile()
  const lists = useLists()
  const archived = useArchivedLists()
  const updateSettings = useUpdateSettings()
  const [open, setOpen] = useState(false)

  const inbox = lists.data?.inbox
  const choices = lists.data ? [...(inbox ? [inbox] : []), ...lists.data.lists] : []
  const savedId = profile.data?.settings.defaultListId ?? null
  const current = choices.find((list) => list.id === savedId) ?? inbox
  const stale = savedId !== null && lists.data !== undefined && current?.id !== savedId
  const staleName = archived.data?.find((list) => list.id === savedId)?.name

  const openPicker = (next: boolean) => {
    // Al tocar la fila, el aviso ya se ha leído: la lista deja de apuntar a la que no está.
    if (next && stale) updateSettings.mutate({ defaultListId: inbox?.id ?? null })
    setOpen(next)
  }
  const choose = (list: List) => {
    updateSettings.mutate({ defaultListId: list.id })
    setOpen(false)
  }

  const row = (
    <button
      type="button"
      aria-label={`Lista por defecto: ${current?.name ?? 'En mente'}`}
      // En escritorio lo abre el `Popover.Trigger` (con `onOpenChange`); aquí, solo en móvil.
      onClick={
        isDesktop
          ? undefined
          : () => {
              openPicker(true)
            }
      }
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 px-4 text-left text-[15px] outline-none hover:bg-fill focus-visible:bg-fill',
        open && 'bg-fill',
      )}
    >
      <span className="font-medium">Lista por defecto</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground">
        {current && <ListMark list={current} />}
        <span className="truncate">{current?.name ?? 'En mente'}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
      </span>
    </button>
  )

  const notice = stale && (
    <p className="px-1 pt-2 text-[13px] leading-[1.4] text-muted-foreground">
      {staleName
        ? `«${staleName}» se archivó, así que ahora se guarda en En mente.`
        : 'La lista que elegiste ya no está, así que ahora se guarda en En mente.'}
    </p>
  )

  const picker = (
    <Picker lists={choices} chosenId={current?.id} onChoose={choose} withSearch={isDesktop} />
  )

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        {isDesktop ? (
          <Popover.Root open={open} onOpenChange={openPicker}>
            <Popover.Trigger asChild>{row}</Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={8}
                collisionPadding={16}
                aria-label="Lista por defecto"
                className="z-50 w-[300px] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
              >
                {picker}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          row
        )}
        {isDesktop && (
          <div className="flex h-13 items-center justify-between border-t border-border-soft px-4 text-[15px]">
            <span className="font-medium">Atajo de teclado</span>
            <kbd className="font-sans font-medium text-muted-foreground">
              {shortcutKey()} ⇧ Espacio
            </kbd>
          </div>
        )}
      </div>
      {notice}
      {!isDesktop && (
        <BottomSheet
          open={open}
          onOpenChange={openPicker}
          title="Lista por defecto"
          className="gap-3"
        >
          <div>
            <p className="font-display text-xl font-extrabold tracking-[-0.02em]">
              Lista por defecto
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Donde cae lo que capturas sin elegir lista.
            </p>
          </div>
          {picker}
        </BottomSheet>
      )}
    </div>
  )
}

/** El símbolo de «En mente» o el punto del color de la lista, junto a su nombre en la fila. */
function ListMark({ list }: { list: List }) {
  if (list.kind === 'inbox') return <InboxMark className="size-3.5" />
  return (
    <span aria-hidden className={cn('size-2 shrink-0 rounded-full', LIST_COLOR_BG[list.color])} />
  )
}

function Picker({
  lists,
  chosenId,
  onChoose,
  withSearch,
}: {
  lists: readonly List[]
  chosenId: string | undefined
  onChoose: (list: List) => void
  withSearch: boolean
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle ? lists.filter((list) => list.name.toLowerCase().includes(needle)) : lists

  return (
    <>
      {withSearch && (
        <label className="mb-1.5 flex h-10 items-center gap-2.5 rounded-xl bg-fill px-3 text-sm text-subtle-foreground">
          <Search aria-hidden className="size-4" strokeWidth={2.2} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            onKeyDown={(event) => {
              const first = shown[0]
              if (event.key === 'Enter' && first) {
                event.preventDefault()
                onChoose(first)
              }
            }}
            placeholder="Buscar lista…"
            aria-label="Buscar lista"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle-foreground"
          />
        </label>
      )}
      <ul
        aria-label="Listas"
        className={cn(
          'flex flex-col gap-0.5 overflow-y-auto',
          withSearch ? 'max-h-[60dvh]' : '-mx-2 max-h-[55dvh]',
        )}
      >
        {shown.map((list) => {
          const selected = list.id === chosenId
          return (
            <li key={list.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChoose(list)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  withSearch ? 'h-11 gap-2.5' : 'min-h-12 py-1.5',
                  selected ? 'bg-brand-tint' : 'hover:bg-fill',
                )}
              >
                <PickerIcon list={list} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate font-semibold',
                      withSearch ? 'text-sm' : 'text-[15px]',
                      selected && 'text-primary-strong',
                    )}
                  >
                    {list.name}
                  </span>
                  {!withSearch && (
                    <span className="block text-xs text-subtle-foreground">
                      {list.kind === 'inbox'
                        ? 'Siempre disponible'
                        : KIND_TEMPLATES[list.kind].label}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check aria-hidden className="size-4 text-primary" strokeWidth={2.6} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PickerIcon({ list }: { list: List }): ReactNode {
  if (list.kind === 'inbox') {
    return (
      <span
        aria-hidden
        className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-brand-tint"
      >
        <InboxMark className="size-4" />
      </span>
    )
  }
  return <ListIcon name={list.name} color={list.color} size="xs" />
}
