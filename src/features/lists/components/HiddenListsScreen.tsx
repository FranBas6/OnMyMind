import { EyeOff } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { UnlockedBand, useUnlocked } from '@/features/private'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import { hiddenBandLabel } from '../hidden'
import { useHiddenLists } from '../hooks/useHiddenLists'
import { ArchivedListsSection } from './ArchivedListsSection'
import { useSeenUnlocked } from '../hooks/useSeenUnlocked'
import { HiddenLocked, HiddenMark } from './HiddenLock'
import { ListGrid } from './ListGrid'
import { ListsSkeleton } from './ListsSkeleton'

/**
 * Perfil › «Listas ocultas» (5.8, diseño 27, D4, D4b, E3 y E5): desbloqueadas, la franja con lo que
 * les queda y «Bloquear», y sus tarjetas, como en Inicio; abajo, las archivadas de aquí. Vacía, cómo
 * se oculta una. Bloqueadas (al rato, al salir de la app o con «Bloquear»), la pantalla se tapa
 * (D3d). No salen en el sidebar ni en Buscar ni desbloqueadas: el desbloqueo solo abre esto.
 */
export function HiddenListsScreen() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const unlocked = useUnlocked() !== null
  const seen = useSeenUnlocked(unlocked)
  const hidden = useHiddenLists()
  const lists = hidden.data ?? []
  const active = lists.filter((list) => !list.archivedAt)
  const archived = lists
    .filter((list) => list.archivedAt)
    .sort((a, b) => (b.archivedAt?.getTime() ?? 0) - (a.archivedAt?.getTime() ?? 0))

  return (
    <div className="flex min-h-[70dvh] flex-col gap-4">
      <PageHeader
        title="Listas ocultas"
        leading={<HiddenMark size="md" />}
        back={{ to: '/profile', label: 'Perfil' }}
      />
      {!unlocked ? (
        <HiddenLocked what="lists" wasUnlocked={seen} />
      ) : (
        <>
          <UnlockedBand label={(minutes) => hiddenBandLabel(minutes, isDesktop)} />
          {hidden.isPending && <ListsSkeleton />}
          {hidden.isError && (
            <p role="alert" className="px-1 text-[15px] text-muted-foreground">
              No hemos podido cargarlas. Prueba otra vez en un momento.
            </p>
          )}
          {hidden.data && active.length === 0 && archived.length === 0 && <Empty />}
          {active.length > 0 && (
            <>
              <ListGrid lists={active} label="Listas ocultas" canCreate={false} />
              <p className="px-1 text-[13.5px] leading-[1.45] text-muted-foreground">
                {isDesktop
                  ? 'No salen en el sidebar ni en Buscar, aunque estén desbloqueadas.'
                  : 'Aquí se usan como siempre. Sus cosas no salen en Hoy ni en Buscar; sus avisos llegan sin título.'}
              </p>
            </>
          )}
          <ArchivedListsSection lists={archived} />
        </>
      )}
    </div>
  )
}

/** «Aquí no hay nada.» (D4b). */
function Empty() {
  return (
    <div className="m-auto flex max-w-[320px] flex-col items-center py-12 text-center">
      <span className="grid size-16 place-items-center rounded-[20px] bg-fill text-muted-foreground">
        <EyeOff aria-hidden className="size-6" strokeWidth={2} />
      </span>
      <h2 className="mt-5 font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
        Aquí no hay nada.
      </h2>
      <p className="mt-2 text-[15px] leading-normal text-muted-foreground">
        Para ocultar una lista, abre su menú ··· y elige «Ocultar». Desaparece de todas partes y
        solo se ve aquí.
      </p>
    </div>
  )
}
