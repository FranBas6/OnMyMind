import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeSelector } from '@/components/ThemeSelector'
import { useSignOut } from '@/features/auth'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

/**
 * Perfil provisional (diseño, pantalla 14): solo «Apariencia» y «Cerrar sesión».
 * La cabecera con avatar, las estadísticas y los ajustes llegan en 1.13.
 */
function ProfilePage() {
  const signOut = useSignOut()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Perfil" />

      <section aria-labelledby="appearance">
        <h2
          id="appearance"
          className="px-1 pb-2 font-sans text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase"
        >
          Apariencia
        </h2>
        <ThemeSelector />
      </section>

      <div className="rounded-[18px] border border-border-soft bg-card">
        <button
          type="button"
          disabled={signOut.isPending}
          onClick={() => {
            signOut.mutate()
          }}
          className="flex h-12 w-full items-center rounded-[18px] px-4 text-[15px] font-medium text-error outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
