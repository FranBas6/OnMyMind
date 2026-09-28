import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useForm } from 'react-hook-form'

import { KeyboardSheetContent } from '@/components/KeyboardSheet'
import {
  authErrorMessage,
  changePasswordSchema,
  FormError,
  PASSWORD_MIN_LENGTH,
  PasswordField,
  useChangePassword,
} from '@/features/auth'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
  isDesktop: boolean
}

/**
 * Cambiar la contraseña (añadido por Fran en 1.13; no está en el diseño). Sigue la hoja del nombre
 * y los campos de Acceso: en móvil, hoja pegada al teclado con «Cancelar · Contraseña ·
 * Guardar»; en escritorio, diálogo de 440 px con los botones abajo a la derecha. Espera al
 * servidor con el formulario abierto, como crear una lista, para enseñar el error sin perder lo
 * escrito.
 */
export function ChangePasswordDialog({ open, onClose, isDesktop }: ChangePasswordDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        {isDesktop ? (
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-[18px] rounded-[28px] border border-border bg-background p-7 text-foreground shadow-dialog outline-none"
          >
            <Dialog.Title className="text-[22px] tracking-[-0.02em]">
              Cambiar la contraseña
            </Dialog.Title>
            <PasswordForm onDone={onClose} isDesktop />
          </Dialog.Content>
        ) : (
          <KeyboardSheetContent title="Cambiar la contraseña">
            <PasswordForm onDone={onClose} isDesktop={false} />
          </KeyboardSheetContent>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PasswordForm({ onDone, isDesktop }: { onDone: () => void; isDesktop: boolean }) {
  const changePassword = useChangePassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit((values) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        onDone()
        showUndoToast({ icon: Check, message: 'Contraseña cambiada' })
      },
    })
  })
  const saving = changePassword.isPending

  const cancel = (
    <button
      type="button"
      onClick={onDone}
      className={cn(
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDesktop
          ? 'h-12 rounded-[14px] bg-fill px-5 font-display text-[15px] font-bold hover:bg-border'
          : 'h-11 pr-2 text-[15px] font-semibold text-muted-foreground hover:text-foreground',
      )}
    >
      Cancelar
    </button>
  )
  const submit = (
    <button
      type="submit"
      disabled={saving}
      className={cn(
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDesktop
          ? 'h-12 rounded-[14px] bg-primary px-[22px] font-display text-[15px] font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60'
          : 'h-11 pl-2 text-[15px] font-bold text-primary hover:text-primary-hover disabled:text-subtle-foreground',
      )}
    >
      {saving ? 'Guardando…' : 'Guardar'}
    </button>
  )

  return (
    <form
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className={cn('flex flex-col gap-3', !isDesktop && 'pb-5')}
    >
      {!isDesktop && (
        <div className="-mt-1 flex items-center justify-between">
          {cancel}
          <p aria-hidden className="font-display text-base font-bold">
            Contraseña
          </p>
          {submit}
        </div>
      )}
      <PasswordField
        label="Contraseña nueva"
        placeholder="Contraseña nueva"
        autoComplete="new-password"
        autoFocus
        hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        label="Repite la contraseña"
        placeholder="Repítela"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      {changePassword.error && <FormError message={authErrorMessage(changePassword.error)} />}
      {isDesktop && (
        <div className="mt-1.5 flex justify-end gap-2.5">
          {cancel}
          {submit}
        </div>
      )}
    </form>
  )
}
