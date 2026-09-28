import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isNetworkError, OFFLINE_MESSAGE } from '@/lib/errors'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { useCreateList, useUpdateList } from '../hooks/useListMutations'
import { CREATABLE_KINDS, listFormSchema, type ListFormValues } from '../schemas'
import { itemCount } from '../templates'
import type { List } from '../types'
import { ColorPicker } from './ColorPicker'
import { KindPicker } from './KindPicker'

interface ListFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Con lista, «Editar lista»; sin ella, «Nueva lista». */
  list?: List | undefined
  /** Al crear, recibe la lista nueva («Nueva lista con esto» mueve ahí el ítem, diseño 05). */
  onCreated?: ((list: List) => void) | undefined
}

/**
 * Crear y editar lista (diseño 04 Listas): pantalla completa en móvil, con la acción en la
 * cabecera; diálogo de 560 px en escritorio, con los botones abajo. Espera al servidor
 * («Creando…») y enseña su error sin cerrarse.
 */
export function ListFormDialog({ open, onOpenChange, list, onCreated }: ListFormDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {isDesktop && <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />}
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col bg-background text-foreground outline-none',
            isDesktop
              ? 'top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-[18px] overflow-y-auto rounded-[28px] border border-border p-7 shadow-dialog'
              : 'inset-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]',
          )}
        >
          <ListForm
            list={list}
            isDesktop={isDesktop}
            onCreated={onCreated}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface ListFormProps {
  list: List | undefined
  isDesktop: boolean
  onCreated: ((list: List) => void) | undefined
  onDone: () => void
}

function ListForm({ list, isDesktop, onCreated, onDone }: ListFormProps) {
  const formId = useId()
  const nameId = useId()
  const createList = useCreateList()
  const updateList = useUpdateList()
  const mutation = list ? updateList : createList
  const editing = Boolean(list)
  const title = editing ? 'Editar lista' : 'Nueva lista'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(listFormSchema),
    defaultValues: {
      name: list?.name ?? '',
      color: list?.color ?? 'indigo',
      kind: list && isCreatableKind(list.kind) ? list.kind : 'tasks',
    },
  })

  const name = useWatch({ control, name: 'name' })
  const color = useWatch({ control, name: 'color' })
  const initial = name.trim().charAt(0).toUpperCase() || '·'
  const kindLocked = list ? itemCount(list) > 0 : false

  const onSubmit = handleSubmit((values: ListFormValues) => {
    if (list) {
      updateList.mutate({ list, values }, { onSuccess: onDone })
      return
    }
    createList.mutate(values, {
      onSuccess: (created) => {
        onCreated?.(created)
        onDone()
      },
    })
  })

  const serverError = mutation.error
    ? isNetworkError(mutation.error)
      ? OFFLINE_MESSAGE
      : editing
        ? 'No se ha podido guardar la lista. Prueba otra vez.'
        : 'No se ha podido crear la lista. Prueba otra vez.'
    : null
  const actionLabel = mutation.isPending
    ? editing
      ? 'Guardando…'
      : 'Creando…'
    : editing
      ? 'Guardar'
      : 'Crear'

  return (
    <>
      {isDesktop ? (
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-[22px] tracking-[-0.02em]">{title}</Dialog.Title>
          <Dialog.Close
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-[10px] bg-fill text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-5" />
          </Dialog.Close>
        </div>
      ) : (
        <div className="flex h-11 items-center justify-between px-5">
          <Dialog.Close className="text-[15px] font-semibold text-muted-foreground outline-none focus-visible:underline">
            Cancelar
          </Dialog.Close>
          <Dialog.Title className="font-display text-base font-bold tracking-normal">
            {title}
          </Dialog.Title>
          <button
            type="submit"
            form={formId}
            disabled={mutation.isPending}
            className={cn(
              'text-[15px] outline-none focus-visible:underline',
              mutation.isPending
                ? 'font-semibold text-subtle-foreground'
                : 'font-bold text-primary',
            )}
          >
            {actionLabel}
          </button>
        </div>
      )}

      <form
        id={formId}
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className={cn('flex flex-col gap-[18px]', !isDesktop && 'px-5 pt-1.5')}
      >
        {!isDesktop && serverError && (
          <p
            role="alert"
            className="rounded-xl bg-priority-high-bg px-3.5 py-2.5 text-[13px] leading-[1.4] text-error"
          >
            {serverError}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className={cn(
                'grid size-16 shrink-0 place-items-center rounded-[20px] font-display text-[26px] font-extrabold text-white',
                LIST_COLOR_BG[color],
              )}
            >
              {initial}
            </span>
            <label htmlFor={nameId} className="sr-only">
              Nombre de la lista
            </label>
            <input
              id={nameId}
              placeholder="Nombre de la lista"
              autoComplete="off"
              autoFocus={!editing}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              className="h-14 min-w-0 flex-1 truncate rounded-2xl border-[1.5px] border-border bg-card px-[18px] font-display text-lg font-bold text-foreground outline-none placeholder:font-display placeholder:text-subtle-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-error"
              {...register('name')}
            />
          </div>
          {errors.name?.message && (
            <p id={`${nameId}-error`} className="px-1 text-[13px] leading-[1.4] text-error">
              {errors.name.message}
            </p>
          )}
        </div>

        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
        />

        <div className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
            Tipo de lista
          </p>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <KindPicker value={field.value} onChange={field.onChange} locked={kindLocked} />
            )}
          />
        </div>

        {isDesktop && (
          <>
            {serverError && (
              <p role="alert" className="px-1 text-[13px] leading-[1.4] text-error">
                {serverError}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2.5">
              <Dialog.Close className="h-12 rounded-[14px] bg-fill px-5 font-display text-[15px] font-bold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Cancelar
              </Dialog.Close>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="h-12 rounded-[14px] bg-primary px-[22px] font-display text-[15px] font-bold text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {actionLabel}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  )
}

function isCreatableKind(kind: List['kind']): kind is ListFormValues['kind'] {
  return (CREATABLE_KINDS as readonly string[]).includes(kind)
}
