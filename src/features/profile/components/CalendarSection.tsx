import { Calendar, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { useOnline } from '@/hooks/useOnline'

import { useCalendarFeed, useCreateCalendarFeed } from '../hooks/useCalendarFeed'
import { CalendarSheet } from './CalendarSheet'

/**
 * «Calendario» de Perfil, bajo Avisos (diseño 21, C1 y D6): la fila «Calendario del iPhone», con
 * «Enlace activo» si ya tienes uno, y debajo qué hace. Abre su hoja; la primera vez, el enlace se
 * crea al tocarla (sin red, cuando vuelva y se toque otra vez).
 */
export function CalendarSection({ isDesktop }: { isDesktop: boolean }) {
  const online = useOnline()
  const feed = useCalendarFeed()
  const create = useCreateCalendarFeed()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            // `calendar_token` devuelve el que ya tengas: pedirlo sin saberlo aún no crea otro.
            if (!feed.data && online && !create.isPending) create.mutate()
          }}
          className="flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill"
        >
          <span className="flex items-center gap-2.5 text-left font-medium">
            <Calendar aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
            Calendario del iPhone
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            {feed.data && 'Enlace activo'}
            <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
          </span>
        </button>
      </div>
      <p className="px-1 text-[13px] leading-normal text-muted-foreground">
        {isDesktop
          ? 'Tus eventos en el Calendario del iPhone o del Mac, solo para ver.'
          : 'Tus eventos en el Calendario, solo para ver.'}
      </p>
      <CalendarSheet
        open={open}
        onOpenChange={setOpen}
        isDesktop={isDesktop}
        creating={create.isPending}
        createFailed={create.isError}
      />
    </div>
  )
}
