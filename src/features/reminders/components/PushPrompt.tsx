import { Bell, Share, SquarePlus, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import { usePush } from '../hooks/usePush'
import { askPermission } from '../push'

/** Qué hoja de los avisos está abierta: activarlos, están bloqueados o hay que instalar. */
export type PushPromptKind = 'activate' | 'denied' | 'install'

interface PushPromptProps {
  kind: PushPromptKind | null
  onKindChange: (kind: PushPromptKind | null) => void
  /** «este iPhone», «este navegador». */
  device: string
  /** El aviso que lo ha traído: su ítem y la frase («Dentista», «1 h antes»). Sin él, Perfil. */
  reminder?: { title: string; phrase: string }
  /** O la compra de «Avisarme si baja» que lo ha traído (diseño 22, A4). */
  priceAlert?: string
  isDesktop: boolean
  /** Abierta desde otra hoja (la ficha en el móvil). */
  nested?: boolean
}

/**
 * Las hojas de los avisos (diseño 18, A1, A5 y A6; en escritorio, D3). Activar pide antes de que
 * salga el diálogo del sistema, que en iOS solo sale una vez. Si dice que no, se cuenta cómo
 * arreglarlo en Ajustes. En Safari del iPhone sin instalar, primero instalar.
 *
 * El diseño pone «Abrir Ajustes» en la hoja de bloqueados, pero una web no puede abrir los Ajustes
 * del sistema: se queda con los pasos y «Entendido».
 */
export function PushPrompt({
  kind,
  onKindChange,
  device,
  reminder,
  priceAlert,
  isDesktop,
  nested = false,
}: PushPromptProps) {
  const { enable } = usePush()
  const close = () => {
    onKindChange(null)
  }
  const activate = () => {
    enable.mutate(askPermission(), {
      onSuccess: (state) => {
        if (state === 'on') {
          close()
          toast(`Avisos activados en ${device}`)
        } else if (state === 'denied') onKindChange('denied')
        else close()
      },
    })
  }
  const ios = device !== 'este navegador'

  const content: Record<PushPromptKind, { title: string; body: ReactNode }> = {
    activate: {
      title: `Activa los avisos en ${device}`,
      body: reminder ? (
        <>
          Para que «{reminder.title}» te avise {reminder.phrase}, {device} tiene que poder mostrar
          avisos. Se activan una vez y sirven para todo.
        </>
      ) : priceAlert ? (
        <>
          Para que te avisemos cuando baje «{priceAlert}», {device} tiene que poder mostrar avisos.
          Se activan una vez y sirven para todo.
        </>
      ) : (
        <>
          Para que tus avisos suenen aquí, {device} tiene que poder mostrarlos. Se activan una vez y
          sirven para todo.
        </>
      ),
    },
    denied: {
      title: `Los avisos están bloqueados en ${device}`,
      body: (
        <>
          {reminder
            ? `El aviso de «${reminder.title}» está guardado, pero aquí no puede sonar.`
            : priceAlert
              ? `El aviso de «${priceAlert}» está guardado, pero aquí no puede sonar.`
              : 'Tus avisos están guardados, pero aquí no pueden sonar.'}{' '}
          Se arregla en un momento en {ios ? 'Ajustes' : 'los ajustes del navegador'}:
        </>
      ),
    },
    install: {
      title: 'Instala OnMyMind para recibir avisos',
      body: (
        <>
          En el iPhone, los avisos solo llegan con la app en la pantalla de inicio.
          {(reminder ?? priceAlert) &&
            ` El aviso de «${reminder?.title ?? priceAlert ?? ''}» ya está guardado: sonará en cuanto la instales.`}
        </>
      ),
    },
  }

  const shown = kind ? content[kind] : null
  const steps =
    kind === 'denied' ? (
      <Steps
        steps={
          ios
            ? [
                <>
                  Abre <b>Ajustes</b>
                </>,
                <>
                  <b>Notificaciones</b> › <b>OnMyMind</b>
                </>,
                <>
                  Activa <b>Permitir notificaciones</b>
                </>,
              ]
            : [
                <>
                  Toca el icono a la izquierda de la <b>dirección</b>
                </>,
                <>
                  En <b>Notificaciones</b>, elige <b>Permitir</b>
                </>,
                <>Vuelve aquí: se activan solos</>,
              ]
        }
      />
    ) : kind === 'install' ? (
      <Steps
        steps={[
          <>
            Toca <Share aria-hidden className="inline size-4 text-primary" /> <b>Compartir</b>,
            abajo
          </>,
          <>
            Elige <SquarePlus aria-hidden className="inline size-4" />{' '}
            <b>Añadir a pantalla de inicio</b>
          </>,
          <>
            Toca <b>Añadir</b> y abre OnMyMind desde allí
          </>,
        ]}
      />
    ) : null
  const actions =
    kind === 'activate' ? (
      <div className={cn('flex gap-2.5', isDesktop ? 'justify-end' : 'flex-col')}>
        <PrimaryButton isDesktop={isDesktop} disabled={enable.isPending} onClick={activate}>
          {enable.isPending ? 'Activando…' : 'Activar avisos'}
        </PrimaryButton>
        <QuietButton isDesktop={isDesktop} onClick={close}>
          Ahora no
        </QuietButton>
      </div>
    ) : kind === 'denied' ? (
      <div className={cn('flex', isDesktop ? 'justify-end' : 'flex-col')}>
        <PrimaryButton isDesktop={isDesktop} onClick={close}>
          Entendido
        </PrimaryButton>
      </div>
    ) : null
  const text = shown && (
    <p className="text-[15px] leading-normal text-muted-foreground">{shown.body}</p>
  )

  if (isDesktop) {
    return (
      <Dialog.Root
        open={kind !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[28px] border border-border bg-background p-7 text-foreground shadow-dialog outline-none">
            <Dialog.Title className="text-[22px] tracking-[-0.02em]">{shown?.title}</Dialog.Title>
            <Dialog.Description asChild>{text}</Dialog.Description>
            {steps}
            {actions}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <BottomSheet
      nested={nested}
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={shown?.title ?? 'Avisos'}
      className="gap-4"
    >
      {kind === 'activate' && (
        <span
          aria-hidden
          className="grid size-14 place-items-center rounded-2xl bg-brand-tint text-primary"
        >
          <Bell className="size-6" strokeWidth={2.2} />
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">
          {shown?.title}
        </p>
        {kind === 'install' && (
          <button
            type="button"
            aria-label="Cerrar"
            onClick={close}
            className="grid size-8 shrink-0 place-items-center rounded-[9px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
      {text}
      {steps}
      {actions}
    </BottomSheet>
  )
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={index} className="flex items-center gap-3 text-[15px]">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-fill font-display text-[13px] font-bold"
          >
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function PrimaryButton({
  isDesktop,
  disabled = false,
  onClick,
  children,
}: {
  isDesktop: boolean
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'bg-primary font-display font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70',
        isDesktop ? 'h-12 rounded-[14px] px-[22px] text-[15px]' : 'h-13 rounded-2xl text-base',
      )}
    >
      {children}
    </button>
  )
}

function QuietButton({
  isDesktop,
  onClick,
  children,
}: {
  isDesktop: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'font-display font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDesktop ? 'order-first h-12 rounded-[14px] px-4 text-[15px]' : 'h-12 text-base',
      )}
    >
      {children}
    </button>
  )
}
