import { createFileRoute, Link } from '@tanstack/react-router'
import { ListPlus } from 'lucide-react'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDisplayName } from '@/features/auth'
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
import { formatHeaderDate } from '@/lib/date'

export const Route = createFileRoute('/_authenticated/')({
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
  const { session } = Route.useRouteContext()
  const displayName = useDisplayName(session.user.id)
  const lists = useLists()

  return (
    <HomeLayout avatar={<Avatar initial={displayName.data?.charAt(0).toUpperCase() ?? ''} />}>
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
      className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-tint text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {initial}
    </Link>
  )
}
