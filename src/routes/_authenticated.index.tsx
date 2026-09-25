import { createFileRoute, Link } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { useDisplayName } from '@/features/auth'
import { formatHeaderDate } from '@/lib/date'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

/** Inicio (diseño, pantalla 2). Las listas llegan en 1.5. */
function HomePage() {
  const { session } = Route.useRouteContext()
  const displayName = useDisplayName(session.user.id)
  const initial = displayName.data?.charAt(0).toUpperCase() ?? ''

  return (
    <PageHeader
      eyebrow={formatHeaderDate(new Date())}
      title="Mis listas"
      trailing={
        <Link
          to="/profile"
          aria-label="Perfil"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-tint text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {initial}
        </Link>
      }
    />
  )
}
