import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatCaptureAge } from '@/lib/date'

import { useRecentCaptures } from '../hooks/useRecentCaptures'
import { counterLabel } from '../templates'
import type { List } from '../types'

/**
 * Tarjeta índigo fijada de «En mente». En móvil (pantalla 2): etiqueta, nombre y contador. En
 * escritorio (diseño 03 Inicio, D1): además, las tres últimas capturas con su antigüedad, para
 * ver qué hay sin abrirla; solo se piden en escritorio.
 */
export function InboxCard({ inbox }: { inbox: List }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const captures = useRecentCaptures(inbox.id, isDesktop)

  return (
    <Link
      to="/lists/$listId"
      params={{ listId: inbox.id }}
      className="flex items-center justify-between gap-4 rounded-3xl bg-inbox-card px-[22px] py-5 text-white shadow-inbox-card outline-none hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:grid md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-7 md:px-6 md:py-[22px]"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase opacity-80 md:opacity-85">
          <img src="/logos/svg/omm-mark-white.svg" alt="" className="size-3.5" />
          Fijada
        </span>
        <span className="truncate font-display text-2xl font-extrabold tracking-[-0.02em]">
          {inbox.name}
        </span>
        <span className="text-sm opacity-85 md:opacity-100">
          {counterLabel('inbox', inbox.counters.pending)}
        </span>
      </div>

      {isDesktop && (
        <ul className="flex min-w-0 flex-col justify-center gap-1.5 self-stretch border-l border-white/25 pl-7 text-sm empty:border-transparent">
          {captures.data?.map((capture) => (
            <li
              key={capture.id}
              className="flex justify-between gap-4 overflow-hidden whitespace-nowrap"
            >
              <span className="truncate">{capture.title}</span>
              <span className="text-xs opacity-85">{formatCaptureAge(capture.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <span className="grid size-13 shrink-0 place-items-center rounded-full bg-white/18">
        <ChevronRight aria-hidden className="size-5" strokeWidth={2.2} />
      </span>
    </Link>
  )
}
