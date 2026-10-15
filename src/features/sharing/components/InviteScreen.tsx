import { Link, useNavigate } from '@tanstack/react-router'
import { Check, Clock, WifiOff, X, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { Spinner } from '@/features/auth/components/Spinner'
import { useOnline } from '@/hooks/useOnline'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { invitedListSummary, joinedDay, personName } from '../copy'
import { useAcceptInvite, useInvitePreview } from '../hooks/useSharing'
import type { InvitePreview } from '../schemas'
import { PersonInitial } from './PersonInitial'

const primaryButton =
  'flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-primary/50'

const quietButton =
  'h-12 w-full rounded-2xl font-display text-[15px] font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * La pantalla del enlace de invitación, con sesión (diseño 20, J2–J10 y D5): a pantalla completa,
 * sin barra ni sidebar. «Fran te invita a «Compras»» con «Unirme» y «Ahora no»; y la misma
 * pantalla con otro texto y un solo botón si el enlace caducó, se anuló, ya estás dentro, es tu
 * lista o no hay conexión. Sin sesión, el enlace lleva antes al acceso (J1).
 */
export function InviteScreen({ token }: { token: string }) {
  const navigate = useNavigate()
  const online = useOnline()
  const preview = useInvitePreview(token)
  const accept = useAcceptInvite(token)
  const goHome = () => {
    void navigate({ to: '/' })
  }

  const data = preview.data
  const listButton = (label: string) =>
    data?.listId && (
      <Link to="/lists/$listId" params={{ listId: data.listId }} className={primaryButton}>
        {label}
      </Link>
    )
  const homeButton = (
    <button type="button" onClick={goHome} className={primaryButton}>
      Ir a mis listas
    </button>
  )

  // Sin datos: aún cargando, sin red o sin poder preguntar (J8).
  if (!data) {
    if (preview.isPending && online) {
      return (
        <Frame>
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Spinner className="size-6" />
          </div>
        </Frame>
      )
    }
    return (
      <Frame
        actions={
          <>
            <button type="button" onClick={() => void preview.refetch()} className={primaryButton}>
              Probar otra vez
            </button>
            <button type="button" onClick={goHome} className={quietButton}>
              Ahora no
            </button>
          </>
        }
      >
        <Message
          figure={<Mark badge={WifiOff} />}
          title={online ? 'No hemos podido abrir la invitación' : 'Para unirte hace falta conexión'}
          text={
            online
              ? 'Prueba otra vez en un momento.'
              : 'La invitación sigue aquí. Prueba cuando vuelva la red.'
          }
        />
      </Frame>
    )
  }

  const listName = data.listName ?? ''
  const inviter = personName(data.inviterName)
  const figure = (badge: LucideIcon | 'inviter', tone?: 'primary') => (
    <Figure preview={data} badge={badge} tone={tone} />
  )

  switch (data.status) {
    case 'valid':
    case 'joined':
      return (
        <Frame
          actions={
            <>
              <button
                type="button"
                disabled={accept.isPending}
                onClick={() => {
                  if (!online) return
                  accept.mutate(undefined, {
                    onSuccess: (result) => {
                      if (result.status !== 'joined') return
                      void navigate({ to: '/' })
                      showUndoToast({ message: `Te has unido a «${listName}»` })
                    },
                  })
                }}
                className={primaryButton}
              >
                {accept.isPending ? (
                  <>
                    <Spinner />
                    Uniéndote…
                  </>
                ) : (
                  'Unirme'
                )}
              </button>
              <button type="button" onClick={goHome} className={quietButton}>
                Ahora no
              </button>
            </>
          }
        >
          {online ? (
            <Message
              figure={figure('inviter')}
              title={`${inviter} te invita a «${listName}»`}
              text={`${invitedListSummary(data.pendingCount)} Podrás añadir, completar, editar y ordenar lo de dentro.`}
              error={
                accept.isError ? 'No hemos podido abrir la invitación. Prueba otra vez.' : undefined
              }
            />
          ) : (
            <Message
              figure={figure(WifiOff)}
              title="Para unirte hace falta conexión"
              text="La invitación sigue aquí. Prueba cuando vuelva la red."
            />
          )}
        </Frame>
      )
    case 'expired':
      return (
        <Frame actions={homeButton}>
          <Message
            figure={figure(Clock)}
            title="Este enlace ha caducado"
            text={`Las invitaciones duran 7 días. Pídele a ${inviter} uno nuevo.`}
          />
        </Frame>
      )
    case 'revoked':
      return (
        <Frame actions={homeButton}>
          <Message
            figure={figure(X)}
            title="Este enlace ya no vale"
            text={`${inviter} lo ha anulado. Si quieres entrar en «${listName}», pídele otro.`}
          />
        </Frame>
      )
    case 'member':
      return (
        <Frame actions={listButton(`Abrir ${listName}`)}>
          <Message
            figure={figure(Check, 'primary')}
            title={`Ya estás en «${listName}»`}
            text={`${data.memberSince ? `Entraste el ${joinedDay(data.memberSince)}. ` : ''}La tienes entre tus listas.`}
          />
        </Frame>
      )
    case 'own':
      return (
        <Frame actions={listButton(`Abrir ${listName}`)}>
          <Message
            figure={figure('inviter')}
            title={`«${listName}» es tu lista`}
            text="Es el enlace que compartiste. Para invitar a alguien, envíaselo a esa persona."
          />
        </Frame>
      )
    case 'unknown':
      return (
        <Frame actions={homeButton}>
          <Message
            figure={<Mark badge={X} />}
            title="Este enlace no funciona"
            text="Puede que esté incompleto. Pídele a quien te lo mandó que te lo envíe otra vez."
          />
        </Frame>
      )
  }
}

/** Marca pequeña arriba, el mensaje en el centro y los botones abajo; en escritorio, 380 px. */
function Frame({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background pt-[calc(env(safe-area-inset-top)+3rem)] pr-[max(env(safe-area-inset-right),1.75rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] pl-[max(env(safe-area-inset-left),1.75rem)] text-foreground">
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col">
        <img src="/logos/svg/omm-mark.svg" alt="OnMyMind" className="mx-auto size-10 dark:hidden" />
        <img
          src="/logos/svg/omm-mark-dark.svg"
          alt="OnMyMind"
          className="mx-auto hidden size-10 dark:block"
        />
        {children}
        {actions && <div className="mt-auto flex flex-col gap-2 pt-8">{actions}</div>}
      </div>
    </main>
  )
}

function Message({
  figure,
  title,
  text,
  error,
}: {
  figure: ReactNode
  title: string
  text: string
  error?: string | undefined
}) {
  return (
    <div className="mt-[18dvh] flex flex-col items-center text-center md:mt-16">
      {figure}
      <h1 className="mt-5 font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-normal text-muted-foreground">{text}</p>
      {error && (
        <p role="alert" className="mt-6 text-[14px] text-error">
          {error}
        </p>
      )}
    </div>
  )
}

/** El icono de la lista (88 px) con la inicial de quien invita o un símbolo en la esquina. */
function Figure({
  preview,
  badge,
  tone,
}: {
  preview: InvitePreview
  badge: LucideIcon | 'inviter'
  tone?: 'primary' | undefined
}) {
  return (
    <span className="relative">
      <ListIcon
        name={preview.listName ?? ''}
        color={preview.listColor ?? 'indigo'}
        icon={preview.listIcon}
        size="xl"
      />
      {badge === 'inviter' ? (
        <PersonInitial
          name={preview.inviterName}
          isOwner
          size="corner"
          className="absolute -right-2 -bottom-2"
        />
      ) : (
        <Badge icon={badge} tone={tone} />
      )}
    </span>
  )
}

/** Sin lista que enseñar (sin red, o un enlace que no existe): la marca, con su símbolo. */
function Mark({ badge }: { badge: LucideIcon }) {
  return (
    <span className="relative grid size-22 place-items-center rounded-[26px] bg-brand-tint">
      <img src="/logos/svg/omm-mark.svg" alt="" className="size-12 dark:hidden" />
      <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-12 dark:block" />
      <Badge icon={badge} />
    </span>
  )
}

function Badge({ icon: Icon, tone }: { icon: LucideIcon; tone?: 'primary' | undefined }) {
  return (
    <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full bg-card ring-[3px] ring-background">
      <Icon
        aria-hidden
        className={cn('size-4', tone === 'primary' ? 'text-primary' : 'text-muted-foreground')}
        strokeWidth={2.4}
      />
    </span>
  )
}
