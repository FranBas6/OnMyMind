import { Check, Clock, Copy, Link as LinkIcon, LogOut, Share, WifiOff } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { InlineConfirm } from '@/components/InlineConfirm'
import { OutlineButton } from '@/components/OutlineButton'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import type { List } from '@/features/lists/types'
import { useCurrentUser, useProfile } from '@/features/profile/hooks/useProfile'
import { useCopied } from '@/hooks/useCopied'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { inviteUrl } from '../api'
import { expiresLabel, inviteMessage, personDetail, personName } from '../copy'
import {
  useActiveInvite,
  useCreateInvite,
  useLeaveList,
  useListPeople,
  useRemoveMember,
  useRevokeInvite,
} from '../hooks/useSharing'
import type { ListPerson } from '../schemas'
import { copyText, displayUrl, shareInvite } from '../share'
import { PersonInitial } from './PersonInitial'

const RIGHTS =
  'Quien entre podrá añadir, completar, editar, borrar y ordenar lo de dentro. Cambiar la lista o invitar a otros sigue siendo cosa tuya.'

const sectionLabel =
  'px-1 pb-2 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase'

/**
 * Quién está en una lista (diseño 20). Para quien la creó es «Compartir «Compras»» (S2–S10, D2 y
 * D7): las personas con «Quitar», y el enlace de invitación para crearlo, copiarlo, enviarlo otra
 * vez o anularlo. Para quien entró es «Quién está» (M4 y M5), con «Salir de la lista». En móvil,
 * hoja con «Listo»; en escritorio, el diálogo de 440 px.
 */
export function ListPeopleSheet({
  list,
  open,
  onOpenChange,
  confirmLeave = false,
  onLeft,
}: {
  list: List
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Abrirla ya preguntando «¿Salir de «Compras»?» (desde «Salir de la lista» del menú, M3). */
  confirmLeave?: boolean
  /** Tras salir: la lista ya no es tuya, quien la enseñaba tiene que irse de ella. */
  onLeft?: (list: List) => void
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const people = useListPeople(list.id, open)
  const me = useCurrentUser()

  const done = (
    <button
      type="button"
      onClick={() => {
        onOpenChange(false)
      }}
      className="rounded-md font-display text-base font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Listo
    </button>
  )

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={list.isOwner ? `Compartir «${list.name}»` : 'Quién está'}
      headerAction={done}
    >
      <section aria-label="Quién está">
        {list.isOwner && <p className={sectionLabel}>Quién está</p>}
        <PeopleCard list={list} people={people.data} meId={me.id} />
      </section>
      {list.isOwner ? (
        <InviteSection list={list} />
      ) : (
        <LeaveSection
          list={list}
          meId={me.id}
          startConfirming={confirmLeave}
          onLeft={() => {
            onOpenChange(false)
            onLeft?.(list)
          }}
        />
      )}
    </ResponsiveSheet>
  )
}

/** La tarjeta con una fila por persona; quien creó la lista ve «Quitar» en los demás (S7, S8). */
function PeopleCard({
  list,
  people,
  meId,
}: {
  list: List
  people: ListPerson[] | undefined
  meId: string
}) {
  const online = useOnline()
  const remove = useRemoveMember(list.id)
  const [removing, setRemoving] = useState<ListPerson | null>(null)
  const profile = useProfile()

  // Hasta que llega la lista de personas, al menos tú (S2: recién abierta, aún sin nadie más).
  const shown: ListPerson[] = people ?? [
    {
      userId: meId,
      displayName: profile.data?.displayName ?? null,
      avatarUrl: null,
      isOwner: list.isOwner,
      joinedAt: null,
    },
  ]

  return (
    <>
      <ul className="overflow-hidden rounded-2xl border border-border-soft bg-fill/60">
        {shown.map((person, index) => {
          const isMe = person.userId === meId
          return (
            <li
              key={person.userId}
              className={cn(
                'flex min-h-[60px] items-center gap-3 px-3.5 py-2.5',
                index > 0 && 'border-t border-border-soft',
              )}
            >
              <PersonInitial name={person.displayName} isOwner={person.isOwner} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {personName(person.displayName)}
                </p>
                <p className="text-[13px] text-muted-foreground">{personDetail(person, isMe)}</p>
              </div>
              {list.isOwner && !isMe && (
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => {
                    setRemoving(person)
                  }}
                  className="-mr-1.5 h-11 rounded-xl px-2.5 text-[14px] font-semibold text-destructive outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
                >
                  Quitar
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setRemoving(null)
          }}
          icon={<PersonInitial name={removing.displayName} isOwner={false} size="lg" />}
          title={`¿Quitar a ${personName(removing.displayName)} de «${list.name}»?`}
          description="Dejará de ver la lista. Lo que añadió se queda en ella."
          confirmLabel={`Quitar a ${personName(removing.displayName)}`}
          onConfirm={() => {
            remove.mutate(removing.userId)
            setRemoving(null)
          }}
        />
      )}
    </>
  )
}

/** El enlace de invitación (S2–S6): crearlo y mandarlo, o el activo con copiar, enviar y anular. */
function InviteSection({ list }: { list: List }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const online = useOnline()
  const profile = useProfile()
  const invite = useActiveInvite(list.id)
  const create = useCreateInvite(list.id)
  const revoke = useRevokeInvite(list.id)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [copied, markCopied] = useCopied()

  const active = invite.data ?? null
  const url = active ? inviteUrl(active.token) : null
  const message = inviteMessage(personName(profile.data?.displayName), list.name)

  // Invitar (S3): la hoja del sistema y, si el navegador no la tiene, se copia con el texto.
  const send = async (link: string) => {
    if ((await shareInvite(link, message)) === 'copied') markCopied()
  }

  // «Enviar otra vez» (S4); en escritorio sin hoja del sistema, «Abrir correo o chat…» abre el
  // correo con el texto (D2).
  const sendAgain = (link: string) => {
    if (typeof navigator.share === 'function') {
      void send(link)
      return
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n${link}`)}`
  }

  const footer = (
    <p className="px-1 text-[13px] leading-[1.45] text-muted-foreground">
      {active ? `El enlace sirve para quien lo abra durante 7 días. ${RIGHTS}` : RIGHTS}
    </p>
  )

  if (!active) {
    return (
      <>
        <button
          type="button"
          disabled={!online || create.isPending || invite.isPending}
          onClick={() => {
            create.mutate(undefined, {
              onSuccess: (created) => {
                void send(inviteUrl(created.token))
              },
            })
          }}
          className={cn(
            'flex items-center justify-center gap-2 font-display font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            isDesktop ? 'h-12 rounded-[14px] text-[15px]' : 'h-13 rounded-2xl text-base',
            online
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-70'
              : 'bg-fill text-muted-foreground',
          )}
        >
          {online ? (
            <LinkIcon aria-hidden className="size-[18px]" strokeWidth={2.4} />
          ) : (
            <WifiOff aria-hidden className="size-[18px]" strokeWidth={2.2} />
          )}
          Invitar con un enlace
        </button>
        {!online && (
          <p className="px-1 text-[13px] leading-[1.45] text-muted-foreground">
            Para invitar hace falta conexión. Lo de la lista sigue funcionando.
          </p>
        )}
        {create.isError && (
          <p role="alert" className="px-1 text-[13px] text-error">
            No se ha podido crear el enlace. Prueba otra vez.
          </p>
        )}
        {footer}
      </>
    )
  }

  return (
    <>
      <section aria-label="Enlace de invitación">
        <p className={sectionLabel}>Enlace de invitación</p>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-fill/60 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-primary">
              <LinkIcon aria-hidden className="size-[18px]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[15px] font-bold">{url && displayUrl(url)}</p>
              <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
                <Clock aria-hidden className="size-3.5" strokeWidth={2.2} />
                {expiresLabel(active.expiresAt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <OutlineButton
              icon={copied ? Check : Copy}
              disabled={!online}
              highlighted={copied}
              onClick={() => {
                if (!url) return
                void copyText(url).then((ok) => {
                  if (ok) markCopied()
                })
              }}
            >
              {copied ? 'Copiado' : 'Copiar enlace'}
            </OutlineButton>
            <OutlineButton
              icon={Share}
              disabled={!online}
              onClick={() => {
                if (url) sendAgain(url)
              }}
            >
              {isDesktop ? 'Abrir correo o chat…' : 'Enviar otra vez'}
            </OutlineButton>
          </div>
          {confirmingRevoke ? (
            <InlineConfirm
              text="¿Anular el enlace? Quien lo tenga ya no podrá unirse. Quien ya entró sigue dentro."
              confirmLabel="Anular"
              onCancel={() => {
                setConfirmingRevoke(false)
              }}
              onConfirm={() => {
                revoke.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmingRevoke(false)
                  },
                })
              }}
              pending={revoke.isPending}
            />
          ) : (
            <button
              type="button"
              disabled={!online}
              onClick={() => {
                setConfirmingRevoke(true)
              }}
              className="mx-auto h-10 rounded-xl px-3 text-[14px] font-semibold text-destructive outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
            >
              Anular enlace
            </button>
          )}
        </div>
      </section>
      {!online && (
        <p className="px-1 text-[13px] leading-[1.45] text-muted-foreground">
          Para invitar hace falta conexión. Lo de la lista sigue funcionando.
        </p>
      )}
      {footer}
    </>
  )
}

/** «Salir de la lista» para quien entró (M4) y su confirmación en el sitio (M5). */
function LeaveSection({
  list,
  meId,
  startConfirming,
  onLeft,
}: {
  list: List
  meId: string
  startConfirming: boolean
  onLeft: () => void
}) {
  const online = useOnline()
  const leave = useLeaveList(list.id)
  const [confirming, setConfirming] = useState(startConfirming)

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <InlineConfirm
          title={`¿Salir de «${list.name}»?`}
          text="Dejarás de verla. Lo que añadiste se queda en la lista."
          confirmLabel="Salir"
          disabled={!online}
          pending={leave.isPending}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            leave.mutate(meId, { onSuccess: onLeft })
          }}
        />
        {!online && (
          <p className="px-1 text-[13px] leading-[1.45] text-muted-foreground">
            Para salir hace falta conexión.
          </p>
        )}
        {leave.isError && (
          <p role="alert" className="px-1 text-[13px] text-error">
            No se ha podido salir. Prueba otra vez.
          </p>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setConfirming(true)
      }}
      className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-border bg-background font-display text-base font-bold text-destructive outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <LogOut aria-hidden className="size-[18px]" strokeWidth={2.2} />
      Salir de la lista
    </button>
  )
}
