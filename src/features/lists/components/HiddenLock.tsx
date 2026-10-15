import { Lock, LockOpen } from 'lucide-react'

import { DeviceIcon, lastLockReason, TextAction, usePrivate } from '@/features/private'

/** El candado en su caja índigo: delante de «Listas ocultas» y en la pantalla tapada (D3d). */
export function HiddenMark({ size }: { size: 'md' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'grid size-16 place-items-center rounded-[20px] bg-brand-tint text-primary'
          : 'grid size-11 shrink-0 place-items-center rounded-[14px] bg-brand-tint text-primary md:size-[52px] md:rounded-2xl'
      }
    >
      <Lock aria-hidden className={size === 'lg' ? 'size-6' : 'size-5'} strokeWidth={2.2} />
    </span>
  )
}

/**
 * Lo que se ve de las listas ocultas bloqueadas (diseño 27, D3d): la pantalla tapada, con
 * «Desbloquear con Face ID» y «Usar la clave» (o solo «Desbloquear» donde no hay Face ID). Si se
 * bloquearon estando dentro, «Se han bloqueado», y a los 5 minutos, «Pasaron 5 minutos».
 * `what`: las listas (su pantalla) o una de ellas (abierta desde un aviso o un enlace).
 */
export function HiddenLocked({
  what,
  wasUnlocked,
}: {
  what: 'lists' | 'list'
  /** Se vio desbloqueada en esta pantalla: entonces es que se ha bloqueado. */
  wasUnlocked: boolean
}) {
  const privacy = usePrivate()
  const withDevice = privacy.deviceKey !== null && privacy.deviceSupported === true
  const title = wasUnlocked
    ? what === 'lists'
      ? 'Se han bloqueado'
      : 'Se ha bloqueado'
    : what === 'lists'
      ? 'Bloqueadas'
      : 'Lista oculta'
  const text = !wasUnlocked
    ? `Desbloquea para ${what === 'lists' ? 'verlas' : 'verla'}.`
    : lastLockReason() === 'timeout'
      ? 'Pasaron 5 minutos. Desbloquea para seguir.'
      : 'Desbloquea para seguir.'

  return (
    <div className="m-auto flex w-full max-w-[360px] flex-col items-center py-12 text-center">
      <HiddenMark size="lg" />
      <h2 className="mt-5 font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-2 text-[15px] leading-normal text-muted-foreground">{text}</p>
      <button
        type="button"
        onClick={() => {
          void privacy.openHidden()
        }}
        className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            void privacy.openHidden({ withKey: true })
          }}
          className="mt-2 h-9 text-[15px]"
        >
          Usar la clave
        </TextAction>
      )}
    </div>
  )
}
