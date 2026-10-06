import { Link, Navigate } from '@tanstack/react-router'
import { ChevronLeft, Users } from 'lucide-react'

import { goneCopy } from '../copy'
import { useDeparture } from '../hooks/useSharing'

/**
 * Una lista compartida contigo que ya no tienes, abierta (diseño 20, M9 y M10): te quitaron, o
 * quien la creó la borró o la archivó. Lo dice y lleva a tus listas. Si no hay nada que contar
 * (una lista tuya que acabas de borrar o archivar), directo a Inicio, como siempre.
 */
export function GoneList({ listId }: { listId: string }) {
  const departure = useDeparture(listId, true)
  if (departure.isPending) return null
  if (!departure.data) return <Navigate to="/" replace />
  const { title, text } = goneCopy(departure.data)
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <Link
        to="/"
        className="-ml-1 flex h-11 items-center gap-1 self-start rounded-xl pr-2 text-[15px] font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronLeft aria-hidden className="size-5" strokeWidth={2.4} />
        Listas
      </Link>
      <div className="m-auto flex max-w-[340px] flex-col items-center py-10 text-center">
        <span className="grid size-[72px] place-items-center rounded-[22px] bg-fill text-muted-foreground">
          <Users aria-hidden className="size-7" strokeWidth={2} />
        </span>
        <h1 className="mt-5 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-2.5 text-[15px] leading-normal text-muted-foreground">{text}</p>
        <Link
          to="/"
          className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-primary px-8 font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Ir a mis listas
        </Link>
      </div>
    </div>
  )
}
