import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isNetworkError, OFFLINE_MESSAGE } from '@/lib/errors'
import { cn } from '@/lib/utils'

import { useCreateList, useUpdateList } from '../hooks/useListMutations'
import { listFormSchema, type ListFormValues } from '../schemas'
import type { List } from '../types'
import { ColorPicker } from './ColorPicker'
import { ListIconPicker } from './ListIconPicker'

/** Lo que explica que una lista no tiene tipo (diseño 25, B8 y D7). */
const ANYTHING_FITS =
  'Dentro cabe de todo: notas, tareas, compras y eventos. Al añadir, la lista te propone lo que más tenga.'

interface ListFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Con lista, «Editar lista»; sin ella, «Nueva lista». */
  list?: List | undefined
  /** Al crear, recibe la lista nueva («Nueva lista con esto» mueve ahí el ítem, diseño 05). */
  onCreated?: ((list: List) => void) | undefined
}

/**
 * Crear y editar lista (diseño 04 Listas; diseño 25, B8 y D7): pantalla completa en móvil, con la
 * acción en la cabecera; diálogo de 460 px en escritorio, con «Esc» y la ✕ arriba y los botones
 * abajo. Una lista no tiene tipo: nombre y color, y al crearla una línea dice que dentro cabe de
 * todo. Espera al servidor («Creando…») y enseña su error sin cerrarse.
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
              ? 'top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[460px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-[18px] overflow-y-auto rounded-[28px] border border-border p-7 shadow-dialog'
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
      icon: list?.icon ?? null,
    },
  })

  const name = useWatch({ control, name: 'name' })
  const color = useWatch({ control, name: 'color' })
  const icon = useWatch({ control, name: 'icon' }) ?? null

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
          <span className="flex items-center gap-2">
            <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
              Esc
            </kbd>
            <Dialog.Close
              aria-label="Cerrar"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-[18px]" strokeWidth={2.2} />
            </Dialog.Close>
          </span>
        </div>
      ) : (
        <div className="flex h-11 items-center justify-between px-5">
          <Dialog.Close className="text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
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
                : 'font-bold text-primary hover:text-primary-hover',
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
            {/* El cuadrado abre el selector de icono o emoji (diseño 28, I1–I6, E1 y E2). */}
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <ListIconPicker
                  name={name}
                  color={color}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  editing={editing}
                  isDesktop={isDesktop}
                />
              )}
            />
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
          {/* Con la inicial, cómo cambiarla (I1); con icono, ya se ve (I5). */}
          {icon === null && !errors.name?.message && (
            <p className="px-1 text-[13px] leading-[1.4] text-muted-foreground">
              Toca el cuadrado para elegir un icono o un emoji.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p
            aria-hidden
            className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
          >
            Color
          </p>
          <Controller
            control={control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </div>

        {!editing && (
          <p className="-mt-1 px-1 text-[13px] leading-normal text-muted-foreground">
            {ANYTHING_FITS}
          </p>
        )}

        {isDesktop && (
          <>
            {serverError && (
              <p role="alert" className="px-1 text-[13px] leading-[1.4] text-error">
                {serverError}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2.5">
              <Dialog.Close className="h-12 rounded-[14px] px-5 font-display text-[15px] font-bold text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Cancelar
              </Dialog.Close>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="h-12 rounded-[14px] bg-primary px-[22px] font-display text-[15px] font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
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
