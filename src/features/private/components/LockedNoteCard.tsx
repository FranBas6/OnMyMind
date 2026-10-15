import { useMutation } from '@tanstack/react-query'
import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'

import { PasswordField } from '@/features/auth'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'

import { tryDeviceLabel, WRONG_KEY } from '../copy'
import { usePrivate } from '../privateContext'
import { useUnlocked } from '../unlock'
import { DeviceIcon } from './DeviceIcon'
import { TextAction } from './SheetParts'

/** Las barras grises en lugar del texto (C8). */
function Bars() {
  return (
    <div aria-hidden className="flex flex-col gap-2.5">
      <span className="h-2.5 w-[72%] rounded-full bg-fill" />
      <span className="h-2.5 w-[88%] rounded-full bg-fill" />
      <span className="h-2.5 w-[56%] rounded-full bg-fill" />
    </div>
  )
}

/**
 * La ficha de una nota protegida sin desbloquear (diseño 26, C8 y D4): barras grises en lugar del
 * texto. En el móvil, «Desbloquear con Face ID» y «Usar la clave»; en escritorio, la clave escrita
 * ahí mismo, sin hoja, con «He olvidado la clave». De la clave anterior (`lost`, C5d), lo dice y
 * no ofrece abrirla: no hay con qué.
 */
export function LockedNoteCard({ isDesktop, lost }: { isDesktop: boolean; lost: boolean }) {
  const privacy = usePrivate()
  const withDevice = privacy.deviceKey !== null && privacy.deviceSupported === true

  if (lost) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-card p-[18px]">
        <Bars />
        <p className="flex gap-2 text-[13.5px] leading-[1.45] text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          Sin texto: era de la clave anterior y sin ella no se puede abrir. La primera línea se
          queda para que sepas cuál era.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-card p-[18px]">
      <Bars />
      <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
        <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
        {isDesktop
          ? 'Protegida. Escribe tu clave para verla.'
          : 'Protegida. Desbloquea para verla.'}
      </p>
      {isDesktop ? (
        <InlineUnlock withDevice={withDevice} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              void privacy.requestUnlock()
            }}
            className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {withDevice ? (
              <>
                <DeviceIcon unlock={privacy.unlock} className="size-[18px]" strokeWidth={2.2} />
                Desbloquear con {privacy.unlock.noun}
              </>
            ) : (
              <>
                <LockOpen aria-hidden className="size-[18px]" strokeWidth={2.2} />
                Desbloquear
              </>
            )}
          </button>
          {withDevice && (
            <TextAction
              onClick={() => {
                void privacy.requestUnlock({ withKey: true })
              }}
              className="h-9 self-center text-[15px]"
            >
              Usar la clave
            </TextAction>
          )}
        </>
      )}
    </div>
  )
}

/** La clave escrita en la ficha (D4, D5): se comprueba en el aparato, también sin red. */
function InlineUnlock({ withDevice }: { withDevice: boolean }) {
  const privacy = usePrivate()
  const [key, setKey] = useState('')
  const [wrong, setWrong] = useState(false)
  const check = useMutation({
    mutationFn: (password: string) => privacy.openWithPassword(password),
    networkMode: 'always',
    onSuccess: (opened) => {
      if (!opened) setWrong(true)
    },
  })
  const disabled = key.length === 0 || check.isPending

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) check.mutate(key)
      }}
      className="flex flex-col gap-3"
    >
      <PasswordField
        label="Clave privada"
        placeholder="Clave privada"
        autoComplete="off"
        data-1p-ignore
        autoFocus
        value={key}
        error={wrong ? WRONG_KEY : undefined}
        onChange={(event) => {
          setKey(event.target.value)
          setWrong(false)
        }}
      />
      <button
        type="submit"
        disabled={disabled}
        className="flex h-[52px] items-center justify-center rounded-[14px] bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-fill disabled:text-muted-foreground"
      >
        {check.isPending ? 'Comprobando…' : 'Desbloquear'}
      </button>
      <div className="flex items-center justify-between gap-3">
        <TextAction onClick={privacy.forgot}>He olvidado la clave</TextAction>
        {withDevice && (
          <TextAction
            onClick={() => {
              void privacy.requestUnlock()
            }}
          >
            <DeviceIcon unlock={privacy.unlock} className="size-3.5" strokeWidth={2.2} />
            {tryDeviceLabel(privacy.unlock)}
          </TextAction>
        )}
      </div>
    </form>
  )
}

/**
 * La franja índigo de una nota desbloqueada (C8b, D6): cuánto le queda y «Bloquear». Lo
 * desbloqueado vale para todas a la vez. `label`, otro texto con los minutos: el de las listas
 * ocultas (diseño 27, D4).
 */
export function UnlockedBand({
  className,
  label = (minutes) => `Desbloqueada · se bloquea sola en ${minutes} min`,
}: {
  className?: string
  label?: (minutes: number) => string
}) {
  const privacy = usePrivate()
  const unlocked = useUnlocked()
  const now = useNow(15_000)
  const minutes = unlocked ? Math.max(1, Math.ceil((unlocked.until - now) / 60_000)) : 0
  return (
    <div
      className={cn(
        'flex min-h-10 items-center gap-2.5 rounded-xl bg-brand-tint px-3.5 py-2 text-[13px] font-semibold text-primary',
        className,
      )}
    >
      <LockOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={2.4} />
      <span className="flex-1">{label(minutes)}</span>
      <button
        type="button"
        onClick={privacy.lock}
        className="-my-1 h-8 shrink-0 rounded-lg px-1 font-bold outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Bloquear
      </button>
    </div>
  )
}
