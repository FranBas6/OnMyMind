import type { ReactNode } from 'react'

import type { List } from '@/features/lists'
import { thisDevice } from '@/lib/device'
import { LIST_COLOR_TEXT, LIST_COLOR_TINT } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { firstItemNoun } from '../copy'
import type { Item } from '../types'
import { SublistIcon } from './SublistIcon'

interface EmptyProps {
  /** El campo de añadir está abajo en móvil y arriba en escritorio: el texto lo dice. */
  isDesktop: boolean
}

/**
 * Lista sin nada (diseño 05, E7 y D4): el patrón de la pantalla 15 sin «Importar» ni «Editar
 * campos», con la nube punteada en el color de la lista.
 */
export function NewListEmpty({ list, isDesktop }: EmptyProps & { list: List }) {
  return (
    <Centered>
      <Tile className={LIST_COLOR_TINT[list.color]}>
        <svg aria-hidden viewBox="0 0 56 56" className={cn('size-12', LIST_COLOR_TEXT[list.color])}>
          <circle
            cx="28"
            cy="26"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="6 6"
          />
          <circle cx="14" cy="46" r="4.5" fill="currentColor" />
          <circle cx="7" cy="53" r="2.5" fill="currentColor" />
        </svg>
      </Tile>
      <Title>Aún no hay nada aquí.</Title>
      <Description>
        {isDesktop ? (
          `Escribe ${firstItemNoun(list.kind)} arriba. También puedes mover aquí cosas desde «En mente».`
        ) : (
          <>
            Escribe {firstItemNoun(list.kind)} abajo, o pulsa <b className="text-foreground">+</b>{' '}
            desde cualquier sitio y elige {list.name}.
          </>
        )}
      </Description>
    </Centered>
  )
}

/**
 * Sublista recién creada (diseño 12, S3): su icono grande en el color de la lista y «Aún no hay
 * nada en Lisboa.». El diseño explicaba con un viaje («lugares, la maleta, el vuelo»); el texto va
 * general, porque una sublista también es un proyecto.
 */
export function SublistEmpty({ sublist, list }: { sublist: Item; list: List }) {
  return (
    <Centered>
      <SublistIcon color={list.color} size="empty" />
      <Title>Aún no hay nada en {sublist.title}.</Title>
      <Description>Añade tareas, compras o eventos: cada cosa con su tipo.</Description>
    </Centered>
  )
}

/**
 * Una lista que nunca se abrió en este dispositivo, sin conexión (diseño 10, I7): aún no hay nada
 * de ella en la caché. Se puede añadir igual: se guarda aquí y se envía al volver la red.
 */
export function NotDownloadedEmpty() {
  return (
    <Centered>
      <Tile className="bg-fill">
        <svg aria-hidden viewBox="0 0 56 56" className="size-12 text-subtle-foreground">
          <circle
            cx="28"
            cy="26"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="6 6"
          />
          <circle cx="14" cy="46" r="4.5" fill="currentColor" />
          <circle cx="7" cy="53" r="2.5" fill="currentColor" />
        </svg>
      </Tile>
      <p className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]">
        Esta lista aún no está en este {thisDevice()}.
      </p>
      <Description>
        Se descargará al volver la conexión. Mientras, puedes añadirle cosas: se guardan aquí y se
        envían después.
      </Description>
    </Centered>
  )
}

/** «En mente» vacía (E3 y D3), con el + de captura en móvil y su atajo en escritorio. */
export function InboxEmpty({ isDesktop }: EmptyProps) {
  return (
    <Centered>
      <Tile className="bg-brand-tint">
        <Mark className="size-12" />
      </Tile>
      <Title>Nada en mente.</Title>
      <Description>
        {isDesktop ? (
          <>
            Disfrútalo. Cuando algo aparezca, escríbelo arriba o pulsa{' '}
            <kbd className="rounded-md bg-fill px-1.5 py-0.5 font-sans text-xs font-semibold text-foreground">
              ⌘⇧Espacio
            </kbd>
          </>
        ) : (
          <>
            Disfrútalo. Cuando algo aparezca, apúntalo abajo o con el{' '}
            <b className="text-foreground">+</b>.
          </>
        )}
      </Description>
    </Centered>
  )
}

/**
 * Todo hecho (E8 y D5): una nota corta encima de «Fuera de la cabeza», que se queda abierta
 * debajo. Con el filtro «Pendientes», solo el título (la sección no se ve).
 */
export function AllDoneNote({ withHint }: { withHint: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 pt-[22px] pb-2.5 text-center md:pt-[18px] md:pb-1.5">
      <div className="grid size-18 place-items-center rounded-3xl bg-brand-tint">
        <Mark className="size-9" />
      </div>
      <p className="font-display text-xl font-extrabold tracking-[-0.02em] whitespace-nowrap">
        Todo fuera de la cabeza.
      </p>
      {withHint && (
        <p className="text-sm leading-normal text-muted-foreground">
          Lo hecho sigue aquí abajo por si lo necesitas.
        </p>
      )}
    </div>
  )
}

/**
 * Un vacío de la lista de eventos (diseño 17, E4–E6): el símbolo sobre su tinte, un título y una
 * frase. Es el de toda la lista recién creada y el de cada filtro sin nada.
 */
export function EventsEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Centered>
      <Tile className="size-16 rounded-[22px] bg-brand-tint">
        <Mark className="size-8" />
      </Tile>
      <Title>{title}</Title>
      <Description>{children}</Description>
    </Centered>
  )
}

/** Una línea discreta cuando un filtro no deja nada que enseñar. */
export function FilterEmpty({ children }: { children: ReactNode }) {
  return <p className="px-1 py-6 text-center text-[15px] text-muted-foreground">{children}</p>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 pb-10 text-center md:pb-15">
      {children}
    </div>
  )
}

function Tile({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={cn('grid size-24 place-items-center rounded-[32px]', className)}>
      {children}
    </div>
  )
}

function Title({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] whitespace-nowrap">
      {children}
    </p>
  )
}

function Description({ children }: { children: ReactNode }) {
  return (
    <p className="-mt-1.5 max-w-[300px] text-[15px] leading-normal text-muted-foreground md:max-w-[360px]">
      {children}
    </p>
  )
}

/** El símbolo de la marca, en su versión clara u oscura según el tema. */
function Mark({ className }: { className: string }) {
  return (
    <>
      <img src="/logos/svg/omm-mark.svg" alt="" className={cn(className, 'dark:hidden')} />
      <img
        src="/logos/svg/omm-mark-dark.svg"
        alt=""
        className={cn(className, 'hidden dark:block')}
      />
    </>
  )
}
