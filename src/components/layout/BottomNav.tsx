import { Link, useRouterState } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import { isDestinationActive, NAV_DESTINATIONS } from './navigation'

/**
 * Barra inferior en móvil (diseño, pantalla 2): cuatro destinos con etiqueta visible, el activo
 * en índigo. 56 px más la zona del indicador de inicio de iOS.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="grid h-14 grid-cols-4 px-3">
        {NAV_DESTINATIONS.map(({ to, label, icon: Icon }) => {
          const active = isDestinationActive(to, pathname)
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-[5px] text-[11px] font-semibold outline-none focus-visible:text-primary',
                  active ? 'text-primary' : 'text-subtle-foreground',
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
