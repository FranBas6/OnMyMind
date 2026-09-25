import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Inbox, Plus, Search, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { isDestinationActive } from './navigation'

/**
 * Sidebar de escritorio (diseño, pantalla D1): marca, buscador (⌘K), accesos a «En mente» y
 * «Hoy», «Mis listas» y «+ Nueva lista». Las listas y los contadores llegan en 1.5; crear
 * listas, en 1.6.
 */
export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  useSearchShortcut()

  return (
    <aside className="sticky top-0 flex h-dvh flex-col gap-[22px] overflow-y-auto border-r border-border-soft bg-secondary px-4 py-6">
      <div className="flex items-center gap-2.5 px-2">
        <img src="/logos/svg/omm-mark.svg" alt="" className="size-7 dark:hidden" />
        <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-7 dark:block" />
        <span className="font-display text-lg font-extrabold tracking-[-0.02em]">OnMyMind</span>
      </div>

      <Link
        to="/search"
        className="flex h-11 items-center gap-2.5 rounded-[14px] border border-border bg-card px-3.5 text-sm text-placeholder outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Search aria-hidden className="size-4" />
        Buscar
        <kbd className="ml-auto rounded-[5px] bg-secondary px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          ⌘K
        </kbd>
      </Link>

      <nav aria-label="Accesos" className="flex flex-col gap-0.5">
        {/* Provisional: en 1.5 «En mente» abrirá el detalle de la lista inbox. */}
        <SidebarLink to="/" icon={Inbox} active={pathname === '/'}>
          En mente
        </SidebarLink>
        <SidebarLink to="/today" icon={Sun} active={isDestinationActive('/today', pathname)}>
          Hoy
        </SidebarLink>
      </nav>

      <section aria-labelledby="sidebar-lists" className="flex flex-col gap-0.5">
        <h2
          id="sidebar-lists"
          className="px-3 pb-2 font-sans text-[11px] font-bold tracking-[0.06em] text-subtle-foreground uppercase"
        >
          Mis listas
        </h2>
      </section>

      <button
        type="button"
        disabled
        className="mt-auto flex h-11 items-center gap-2.5 rounded-[14px] px-3 text-sm font-semibold text-primary disabled:opacity-50"
      >
        <Plus aria-hidden className="size-4" />
        Nueva lista
      </button>
    </aside>
  )
}

interface SidebarLinkProps {
  to: '/' | '/today'
  icon: LucideIcon
  active: boolean
  children: ReactNode
}

function SidebarLink({ to, icon: Icon, active, children }: SidebarLinkProps) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'font-semibold text-primary' : 'font-medium',
      )}
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </Link>
  )
}

/** ⌘K (Ctrl+K fuera de Mac) lleva a Buscar desde cualquier pantalla de escritorio. */
function useSearchShortcut() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void navigate({ to: '/search' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [navigate])
}
