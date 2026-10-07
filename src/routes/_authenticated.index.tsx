import { createFileRoute, Link } from '@tanstack/react-router'
import { ListPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceDropsSheet } from '@/features/items'
import {
  ArchivedListsSection,
  InboxCard,
  ListGrid,
  listsQueryOptions,
  ListsSkeleton,
  NewListEmptyButton,
  NewListHeaderButton,
  NewListRoundButton,
  useLists,
} from '@/features/lists'
import { initialOf, useProfile } from '@/features/profile'
import { formatHeaderDate } from '@/lib/date'

/**
 * `?bajadas=hoy` abre «Bajaron esta mañana» (3.8, diseño 22, N3): es a donde lleva el aviso de
 * varias bajadas a la vez.
 */
const searchSchema = z.object({
  bajadas: z.literal('hoy').optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: searchSchema,
  // En escritorio, Inicio va a 880 px para que quepan tres tarjetas (diseño 03 Inicio).
  staticData: { wide: true },
  // Pide las listas antes de pintar: `query()` devuelve la caché si está fresca y, si no, la
  // pide. Si falla no se lanza (la pantalla de error de TanStack está en inglés): el error se
  // queda en la caché y lo muestra la pantalla con `useLists`, en la voz de la marca.
  loader: ({ context }) => context.queryClient.query(listsQueryOptions).catch(() => undefined),
  // Solo aparece si el loader tarda más de un segundo (`pendingMs` por defecto).
  pendingComponent: () => (
    <HomeLayout avatar={<span className="size-11 shrink-0 rounded-full bg-muted" />}>
      <ListsSkeleton />
    </HomeLayout>
  ),
  component: HomePage,
})

/** Inicio (pantalla 2 y diseño 03 Inicio): «En mente» fijada y la rejilla del resto de listas. */
function HomePage() {
  const profile = useProfile()
  const lists = useLists()
  const { bajadas } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <HomeLayout
      avatar={<Avatar initial={profile.data ? initialOf(profile.data.displayName) : ''} />}
    >
      {lists.isPending && <ListsSkeleton />}
      {lists.isError && (
        <p role="alert" className="px-1 text-[15px] text-muted-foreground">
          No hemos podido cargar tus listas. Prueba otra vez en un momento.
        </p>
      )}
      {lists.isSuccess && (
        <>
          {lists.data.inbox && <InboxCard inbox={lists.data.inbox} />}
          {lists.data.lists.length > 0 ? (
            <ListGrid lists={lists.data.lists} />
          ) : (
            <EmptyState
              icon={ListPlus}
              title="Aún no hay listas."
              description="Crea la primera para ordenar lo que tienes en mente."
            >
              <NewListEmptyButton />
            </EmptyState>
          )}
          <ArchivedListsSection />
        </>
      )}
      <PriceDropsSheet
        open={bajadas === 'hoy'}
        onOpenChange={(open) => {
          if (!open) void navigate({ search: {}, replace: true })
        }}
      />
    </HomeLayout>
  )
}

function HomeLayout({ avatar, children }: { avatar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[18px] md:gap-7">
      <PageHeader
        eyebrow={formatHeaderDate(new Date())}
        title="Mis listas"
        trailing={
          <div className="flex items-center gap-2.5 md:gap-3">
            <NewListRoundButton />
            <NewListHeaderButton />
            {avatar}
          </div>
        }
      />
      {children}
    </div>
  )
}

function Avatar({ initial }: { initial: string }) {
  return (
    <Link
      to="/profile"
      aria-label="Perfil"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-tint text-[15px] font-bold text-primary outline-none hover:bg-primary/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {initial}
    </Link>
  )
}
