import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Archive, Inbox, Plus, Search, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { ARCHIVED_SECTION_ID, useArchivedLists, useLists, useListActions } from '@/features/lists'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { isDestinationActive } from './navigation'

/**
 * Sidebar de escritorio (diseño, pantalla D1): marca, buscador (⌘K), accesos a «En mente» y
 * «Hoy», «Mis listas» con su color y contador, la mención de las archivadas y «+ Nueva lista».
 * El contador de «Hoy» llega con la vista Hoy (1.11).
 */
export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lists = useLists()
  const archived = useArchivedLists()
  const archivedCount = archived.data?.length ?? 0
  const { openCreate } = useListActions()
  const inbox = lists.data?.inbox
  useSearchShortcut()

  return (
    <aside className="sticky top-0 flex h-dvh flex-col gap-[22px] overflow-y-auto border-r border-border-soft bg-secondary px-4 py-6">
      {/* La marca lleva a Inicio (diseño 03 Inicio). */}
      <Link
        to="/"
        aria-label="OnMyMind, Inicio"
        className="flex items-center gap-2.5 self-start rounded-xl px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <img src="/logos/svg/omm-mark.svg" alt="" className="size-7 dark:hidden" />
        <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-7 dark:block" />
        <span className="font-display text-lg font-extrabold tracking-[-0.02em]">OnMyMind</span>
      </Link>

      <Link
        to="/search"
        className="flex h-11 items-center gap-2.5 rounded-[14px] border border-border bg-card px-3.5 text-sm text-subtle-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Search aria-hidden className="size-4" />
        Buscar
        <kbd className="ml-auto rounded-[5px] bg-secondary px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          ⌘K
        </kbd>
      </Link>

      <nav aria-label="Accesos" className="flex flex-col gap-0.5">
        {inbox && (
          <SidebarLink
            to="/lists/$listId"
            params={{ listId: inbox.id }}
            icon={Inbox}
            active={pathname === `/lists/${inbox.id}`}
            count={inbox.counters.pending}
          >
            {inbox.name}
          </SidebarLink>
        )}
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
        <ul className="flex flex-col gap-0.5">
          {lists.data?.lists.map((list) => {
            const active = pathname === `/lists/${list.id}`
            return (
              <li key={list.id}>
                <Link
                  to="/lists/$listId"
                  params={{ listId: list.id }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    active && 'bg-card',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('size-3 shrink-0 rounded-[4px]', LIST_COLOR_BG[list.color])}
                  />
                  <span className="truncate">{list.name}</span>
                  <Count value={list.counters.pending} />
                </Link>
              </li>
            )
          })}
        </ul>
        {/* Las archivadas se mencionan en gris, sin contar como lista (diseño 04 Listas, D8). */}
        {archivedCount > 0 && (
          <Link
            to="/"
            hash={ARCHIVED_SECTION_ID}
            className="mt-1.5 flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium text-subtle-foreground outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Archive aria-hidden className="size-[18px]" strokeWidth={2} />
            Archivadas
            <Count value={archivedCount} />
          </Link>
        )}
      </section>

      <button
        type="button"
        onClick={openCreate}
        className="mt-auto flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] px-3 text-sm font-semibold text-primary outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-4" />
        Nueva lista
      </button>
    </aside>
  )
}

type SidebarLinkProps = (
  { to: '/today'; params?: never } | { to: '/lists/$listId'; params: { listId: string } }
) & {
  icon: LucideIcon
  active: boolean
  count?: number
  children: ReactNode
}

function SidebarLink({ to, params, icon: Icon, active, count, children }: SidebarLinkProps) {
  return (
    <Link
      {...(params ? { to, params } : { to })}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'font-semibold text-primary' : 'font-medium',
      )}
    >
      <Icon aria-hidden className="size-4" />
      <span className="truncate">{children}</span>
      {count !== undefined && <Count value={count} />}
    </Link>
  )
}

function Count({ value }: { value: number }) {
  return <span className="ml-auto text-xs font-normal text-subtle-foreground">{value}</span>
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
