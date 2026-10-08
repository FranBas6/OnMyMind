import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Archive, Inbox, Plus, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode, type SyntheticEvent } from 'react'

import { useCapture } from '@/features/capture'
import {
  ARCHIVED_SECTION_ID,
  ListContextMenu,
  ListsDnd,
  useArchivedLists,
  useListActions,
  useListDrag,
  useLists,
  type List,
} from '@/features/lists'
import { ProfileLink } from '@/features/profile'
import { focusSearchField, SidebarSearchField } from '@/features/search'
import { useTodayCount } from '@/features/today'
import { SidebarSharedIcon } from '@/features/sharing/components/SharedInitials'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { OfflineBanner } from '@/components/OfflineBanner'
import { cn } from '@/lib/utils'
import { shortcutKey } from '@/lib/device'

import { isDestinationActive } from './navigation'

/**
 * Sidebar de escritorio (diseño, pantalla D1): marca, buscador (⌘K), accesos a «En mente» y
 * «Hoy» (con lo que queda por hacer hoy), «Mis listas» con su color y contador, la mención de las
 * archivadas, «+ Nueva lista» y, al pie, tu avatar, que abre Perfil (diseño 09).
 */
export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lists = useLists()
  const archived = useArchivedLists()
  const archivedCount = archived.data?.length ?? 0
  const { openCreate } = useListActions()
  const capture = useCapture()
  const todayCount = useTodayCount()
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

      {/* La entrada visible de la captura: el único botón relleno del sidebar (diseño 07, D1). */}
      <button
        type="button"
        onClick={() => {
          capture.open()
        }}
        className="flex h-12 shrink-0 items-center gap-2 rounded-[14px] bg-primary px-3.5 font-display text-[13px] font-bold whitespace-nowrap text-primary-foreground shadow-fab outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.4} />
        ¿Qué tienes en mente?
        <kbd className="ml-auto rounded-[5px] bg-white/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold">
          {shortcutKey()}⇧␣
        </kbd>
      </button>

      <SidebarSearchField />

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
        <SidebarLink
          to="/today"
          icon={Sun}
          active={isDestinationActive('/today', pathname)}
          count={todayCount}
        >
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
        {/* Se ordenan arrastrando (2.9, diseño 14, D5); «Archivadas» no se mueve. */}
        <ListsDnd
          lists={lists.data?.lists ?? []}
          strategy={verticalListSortingStrategy}
          renderLifted={(list) => <SidebarListRow list={list} lifted />}
        >
          <ul className="flex flex-col gap-0.5">
            {lists.data?.lists.map((list) => (
              <SortableSidebarList
                key={list.id}
                list={list}
                // También dentro de una de sus sublistas (diseño 12, D5).
                active={
                  pathname === `/lists/${list.id}` || pathname.startsWith(`/lists/${list.id}/`)
                }
              />
            ))}
          </ul>
        </ListsDnd>
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

      <div className="mt-auto flex flex-col gap-0.5">
        {/* Sin red, al pie, sobre «+ Nueva lista» (diseño 10, D1). */}
        <OfflineBanner variant="sidebar" />
        <button
          type="button"
          onClick={() => {
            openCreate()
          }}
          className="flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] px-3 text-sm font-semibold text-primary outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus aria-hidden className="size-4" />
          Nueva lista
        </button>
        <ProfileLink />
      </div>
    </aside>
  )
}

/** Una lista de «Mis listas», que se ordena arrastrándola con el ratón (diseño 14, D5). */
function SortableSidebarList({ list, active }: { list: List; active: boolean }) {
  const drag = useListDrag()
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { label: list.name },
  })
  // dnd-kit lo da como `Function`: el manejador de su sensor de ratón.
  const onMouseDown = listeners?.onMouseDown as ((event: SyntheticEvent) => void) | undefined
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-xl',
        isDragging && 'border border-dashed border-primary/50 bg-brand-tint',
      )}
    >
      <ListContextMenu list={list}>
        <Link
          to="/lists/$listId"
          params={{ listId: list.id }}
          aria-current={active ? 'page' : undefined}
          onMouseDown={onMouseDown}
          onClickCapture={(event) => {
            if (drag?.swallowsClick()) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
          className={cn(
            'flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50',
            active && 'bg-card',
            drag?.settledId === list.id && 'bg-brand-tint',
            isDragging && 'invisible',
          )}
        >
          <SidebarListRow list={list} />
        </Link>
      </ListContextMenu>
    </li>
  )
}

/** Lo de dentro de la fila de una lista; levantada, en una tarjeta con sombra (D5). */
function SidebarListRow({ list, lifted = false }: { list: List; lifted?: boolean }) {
  const content = (
    <>
      <span
        aria-hidden
        className={cn('size-3 shrink-0 rounded-[4px]', LIST_COLOR_BG[list.color])}
      />
      <span className="truncate">{list.name}</span>
      <SidebarSharedIcon list={list} />
      <Count value={list.counters.pending} />
    </>
  )
  if (!lifted) return content
  return (
    <div className="flex h-10 cursor-grabbing items-center gap-2.5 rounded-xl border border-border-soft bg-card px-3 text-sm font-medium shadow-lift">
      {content}
    </div>
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

/**
 * ⌘K (Ctrl+K fuera de Mac) lleva a Buscar desde cualquier pantalla de escritorio, con el foco en
 * su campo grande (diseño 08, D1); ya en Buscar, solo le devuelve el foco.
 */
function useSearchShortcut() {
  const navigate = useNavigate()
  const router = useRouter()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (router.state.location.pathname === '/search') focusSearchField()
        else void navigate({ to: '/search' }).then(focusSearchField)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [navigate, router])
}
