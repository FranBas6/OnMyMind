import { useId, useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AuthFieldProps extends ComponentProps<typeof Input> {
  /** Etiqueta accesible; en el diseño no se ve, el placeholder hace de etiqueta visual. */
  label: string
  error?: string | undefined
  /** Pista fija bajo el campo; al fallar, el error ocupa su hueco y el formulario no salta. */
  hint?: string | undefined
}

// Campos del diseño Acceso: 52 px, radio 16, borde de 1,5 px y fondo de tarjeta. El texto va a
// 16 px y no a los 15 del diseño: por debajo de 16, Safari en iOS amplía la página al enfocar.
const fieldClassName = cn(
  'h-13 rounded-md border-[1.5px] border-border bg-card px-[18px] text-base shadow-none md:text-base dark:bg-card',
  'placeholder:text-placeholder aria-invalid:border-error aria-invalid:ring-error/20 dark:aria-invalid:ring-error/30',
)

export function AuthField({ label, error, hint, className, ...props }: AuthFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const hasMessage = Boolean(error ?? hint)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={cn(fieldClassName, className)}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}

/** Contraseña con el botón «Mostrar» dentro del campo, como en el diseño. */
export function PasswordField({ label, error, hint, className, ...props }: AuthFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const hasMessage = Boolean(error ?? hint)
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(fieldClassName, 'pr-24', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => {
            setVisible((current) => !current)
          }}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-md px-[18px] text-[13px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}

interface FieldMessageProps {
  id: string
  error: string | undefined
  hint: string | undefined
}

function FieldMessage({ id, error, hint }: FieldMessageProps) {
  const message = error ?? hint
  if (!message) return null
  return (
    <p
      id={id}
      className={cn(
        'px-1 text-[13px] leading-[1.4]',
        error ? 'text-error' : 'text-subtle-foreground',
      )}
    >
      {message}
    </p>
  )
}

/** Error del servidor: una línea justo encima del botón, alineada con los campos. */
export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 px-1 text-[13px] leading-[1.4] text-error">
      {message}
    </p>
  )
}
