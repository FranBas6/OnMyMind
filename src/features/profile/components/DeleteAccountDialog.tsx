import { useState } from 'react'

import { FormError } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { confirmsDeletion, deleteSummary } from '../account'
import { useAccountCounts, useDeleteAccount } from '../hooks/useAccountData'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  /** «exporta tus datos» abre la hoja de exportar en su lugar. */
  onExport: () => void
}

/**
 * «¿Borrar tu cuenta?» (diseño 18, P9, P10 y D7): lo que se borra, con sus números, el enlace a
 * exportar y la confirmación fuerte, escribir «borrar», como la de borrar una lista (04 Listas).
 * Hasta entonces el botón va en gris. Mientras se borra, «Borrando tu cuenta…» y no se puede
 * cerrar; si falla, la cuenta sigue (quizá ya sin fotos, que se borran antes) y se puede volver a
 * probar.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  isDesktop,
  onExport,
}: DeleteAccountDialogProps) {
  const [text, setText] = useState('')
  const counts = useAccountCounts(open)
  const deleteAccount = useDeleteAccount()
  const online = useOnline()
  const ready = confirmsDeletion(text) && online && !deleteAccount.isPending

  const change = (next: boolean) => {
    if (deleteAccount.isPending) return
    if (!next) {
      setText('')
      deleteAccount.reset()
    }
    onOpenChange(next)
  }

  const cancel = (
    <button
      type="button"
      disabled={deleteAccount.isPending}
      onClick={() => {
        change(false)
      }}
      className={cn(
        'font-display font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
        isDesktop
          ? 'h-12 rounded-[14px] px-4 text-[15px] text-muted-foreground hover:text-foreground'
          : 'h-11 text-base text-muted-foreground',
      )}
    >
      Cancelar
    </button>
  )

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={change}
      isDesktop={isDesktop}
      title="¿Borrar tu cuenta?"
    >
      <p className="-mt-1 text-[15px] leading-normal">
        {deleteSummary(counts.data).map((segment, index) =>
          segment.strong ? (
            <strong key={index} className="font-bold">
              {segment.text}
            </strong>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
      <p className="-mt-1 text-[13.5px] leading-[1.45] text-muted-foreground">
        Si quieres quedarte con algo,{' '}
        <button
          type="button"
          onClick={onExport}
          className="rounded-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          exporta tus datos
        </button>{' '}
        antes.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (ready) deleteAccount.mutate()
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[13px] font-semibold text-muted-foreground">
            Escribe «borrar» para confirmar
          </span>
          <input
            value={text}
            onChange={(event) => {
              setText(event.target.value)
            }}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            disabled={deleteAccount.isPending}
            className="h-12 rounded-[14px] border border-border bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-ring/30"
          />
        </label>

        {deleteAccount.isError && (
          <FormError message="No se ha podido borrar la cuenta. Prueba otra vez en un momento." />
        )}
        {!online && (
          <FormError message="Sin conexión. Para borrar la cuenta hace falta conexión." />
        )}

        <div className={cn('flex flex-col gap-1', isDesktop && 'mt-1 flex-row-reverse gap-2.5')}>
          <button
            type="submit"
            disabled={!ready}
            className={cn(
              'font-display font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isDesktop
                ? 'h-12 rounded-[14px] px-[22px] text-[15px]'
                : 'h-13 rounded-2xl text-base',
              ready || deleteAccount.isPending
                ? 'bg-destructive text-destructive-foreground hover:brightness-95'
                : 'bg-fill text-subtle-foreground',
            )}
          >
            {deleteAccount.isPending ? 'Borrando tu cuenta…' : 'Borrar mi cuenta'}
          </button>
          {cancel}
        </div>
      </form>
    </ResponsiveSheet>
  )
}
