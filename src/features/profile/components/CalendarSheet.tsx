import { Calendar, Check, Copy, ExternalLink, Eye, WifiOff } from 'lucide-react'
import { Fragment, useState } from 'react'

import { InlineConfirm } from '@/components/InlineConfirm'
import { OutlineButton } from '@/components/OutlineButton'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { copyText } from '@/features/sharing/share'
import { useCopied } from '@/hooks/useCopied'
import { useOnline } from '@/hooks/useOnline'
import type { DevicePlatform } from '@/lib/device'
import { cn } from '@/lib/utils'

import { useCalendarFeed, useRotateCalendarFeed } from '../hooks/useCalendarFeed'

/**
 * «Calendario del iPhone» (diseño 21, C2–C7 y D6): qué entra y qué no, «Suscribirse en el
 * Calendario» (`webcal://`), el enlace con «Copiar enlace» y el aviso de que quien lo tenga ve tus
 * eventos, y «Cambiar enlace» con su confirmación en el sitio (C4). Al cambiarlo, el nuevo se
 * resalta y lo dice debajo (C5). Sin red (C6), suscribirse y cambiar se apagan; copiar no, porque
 * el enlace va guardado. En móvil, hoja con «Listo»; en escritorio, el diálogo («Abrir en
 * Calendario», que en el Mac también suscribe).
 *
 * Fuera de Apple (diseño 23, A2, A3 y E1), «Añadir a tu calendario»: `webcal://` no sirve ahí, así
 * que el botón grande copia la dirección `https://` y la caja dice cómo pegarla en Google Calendar
 * y en Outlook (Google primero en Android; Outlook, en el ordenador).
 */

/** Cómo se añade en cada calendario, en el orden de cada sitio. */
const HOW_TO = {
  google: ['Google Calendar', 'Otros calendarios › Desde URL, y pega el enlace.'],
  outlook: ['Outlook', 'Añadir calendario › Suscribirse desde la web, y pega el enlace.'],
} as const
export function CalendarSheet({
  open,
  onOpenChange,
  isDesktop,
  platform,
  creating,
  createFailed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  platform: DevicePlatform
  /** Si se está creando el enlace (la primera vez, al tocar la fila) o no se pudo. */
  creating: boolean
  createFailed: boolean
}) {
  const online = useOnline()
  const feed = useCalendarFeed()
  const rotate = useRotateCalendarFeed()
  const [confirming, setConfirming] = useState(false)
  const [rotated, setRotated] = useState(false)
  const [copied, markCopied] = useCopied()
  const apple = platform === 'apple'
  const url = apple ? feed.url : feed.httpsUrl

  const copy = () => {
    if (!url) return
    void copyText(url).then((ok) => {
      if (ok) markCopied()
    })
  }

  const changeOpen = (next: boolean) => {
    if (!next) {
      setConfirming(false)
      setRotated(false)
    }
    onOpenChange(next)
  }

  const done = (
    <button
      type="button"
      onClick={() => {
        changeOpen(false)
      }}
      className="rounded-md font-display text-base font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Listo
    </button>
  )

  const canSubscribe = online && url !== null
  const howTo =
    platform === 'android' ? [HOW_TO.google, HOW_TO.outlook] : [HOW_TO.outlook, HOW_TO.google]

  const urlText = (
    <p
      className={cn(
        'min-w-0 flex-1 truncate font-mono text-[14px]',
        rotated ? 'rounded-md bg-brand-tint px-1.5 text-primary-strong' : 'text-muted-foreground',
      )}
    >
      {url ?? (creating || feed.isPending ? 'Creando el enlace…' : 'Aún sin enlace')}
    </p>
  )

  const warning = (
    <p className="flex gap-2 text-[13px] leading-[1.45] text-muted-foreground">
      <Eye aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
      Quien tenga este enlace ve tus eventos. No lo compartas; si se te escapa, cámbialo.
    </p>
  )

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={changeOpen}
      isDesktop={isDesktop}
      title={apple ? 'Calendario del iPhone' : 'Añadir a tu calendario'}
      headerAction={done}
    >
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-brand-tint text-primary">
          <Calendar aria-hidden className="size-6" strokeWidth={2.2} />
        </span>
        <p className="text-[15px] leading-normal">
          {apple
            ? 'Tus eventos salen en el Calendario, junto a los demás. Son solo para ver: se cambian aquí. El Calendario los pone al día solo, cada pocas horas.'
            : 'Tus eventos salen en tu calendario, junto a los demás. Son solo para ver: se cambian aquí. El calendario los pone al día solo, cada pocas horas.'}
        </p>
      </div>

      {apple && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-2.5 text-[14px] leading-[1.45]">
          <dt className="font-bold">Entran</dt>
          <dd className="text-muted-foreground">
            Los eventos de todas tus listas, también los compartidos.
          </dd>
          <dt className="font-bold">No entran</dt>
          <dd className="text-muted-foreground">Las tareas, las compras ni lo de «En mente».</dd>
        </dl>
      )}

      {!online && (
        <p className="flex gap-2 px-1 text-[13px] leading-[1.45] text-muted-foreground">
          <WifiOff aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          {apple
            ? 'Para suscribirte o cambiar el enlace hace falta conexión.'
            : 'Para cambiar el enlace hace falta conexión.'}
        </p>
      )}

      {apple ? (
        <>
          {/* Un enlace y no un botón: `webcal://` lo abre el sistema en el Calendario. */}
          <a
            href={canSubscribe ? url : undefined}
            aria-disabled={!canSubscribe}
            className={cn(
              'flex h-13 items-center justify-center gap-2 rounded-2xl font-display text-base font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              canSubscribe
                ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                : 'pointer-events-none bg-fill text-muted-foreground',
            )}
          >
            <ExternalLink aria-hidden className="size-[18px]" strokeWidth={2.4} />
            {isDesktop ? 'Abrir en Calendario' : 'Suscribirse en el Calendario'}
          </a>

          <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-fill/60 p-3.5">
            <div className="flex items-center gap-3">
              {urlText}
              <OutlineButton
                icon={copied ? Check : Copy}
                highlighted={copied}
                disabled={url === null}
                onClick={copy}
                className="shrink-0 px-3.5"
              >
                {copied ? 'Copiado' : 'Copiar enlace'}
              </OutlineButton>
            </div>
            {warning}
          </div>
        </>
      ) : (
        <>
          {/* Copiar funciona sin red: el enlace va guardado. */}
          <button
            type="button"
            disabled={url === null}
            onClick={copy}
            className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-fill disabled:text-muted-foreground"
          >
            {copied ? (
              <Check aria-hidden className="size-[18px]" strokeWidth={2.4} />
            ) : (
              <Copy aria-hidden className="size-[18px]" strokeWidth={2.4} />
            )}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>

          <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-fill/60 p-3.5">
            {urlText}
            <dl className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-2.5 text-[14px] leading-[1.45]">
              {howTo.map(([name, steps]) => (
                <Fragment key={name}>
                  <dt className="max-w-24 font-bold">{name}</dt>
                  <dd className="text-muted-foreground">{steps}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
          <div className="px-1">{warning}</div>
        </>
      )}

      {confirming ? (
        <InlineConfirm
          text={
            apple
              ? '¿Cambiar el enlace? El anterior deja de funcionar y el Calendario dejará de ponerse al día hasta que te suscribas con el nuevo.'
              : '¿Cambiar el enlace? El anterior deja de funcionar y tu calendario dejará de ponerse al día hasta que añadas el nuevo.'
          }
          confirmLabel="Cambiar"
          disabled={!online}
          pending={rotate.isPending}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            rotate.mutate(undefined, {
              onSuccess: () => {
                setConfirming(false)
                setRotated(true)
              },
            })
          }}
        />
      ) : rotated ? (
        <p className="px-1 text-[14px] leading-normal text-primary-strong">
          {apple
            ? 'Enlace nuevo. El anterior ya no funciona: suscríbete otra vez para seguir viéndolos en el Calendario.'
            : 'Enlace nuevo. El anterior ya no funciona: cópialo y añádelo otra vez a tu calendario.'}
        </p>
      ) : (
        <button
          type="button"
          disabled={!online || url === null}
          onClick={() => {
            setConfirming(true)
          }}
          className="mx-auto h-10 rounded-xl px-3 text-[15px] font-semibold text-destructive outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-muted-foreground"
        >
          Cambiar enlace
        </button>
      )}

      {(createFailed || rotate.isError) && (
        <p role="alert" className="px-1 text-[13px] text-error">
          {rotate.isError
            ? 'No se ha podido cambiar el enlace. Prueba otra vez.'
            : 'No se ha podido crear el enlace. Prueba otra vez.'}
        </p>
      )}
    </ResponsiveSheet>
  )
}
