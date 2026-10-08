import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { shortcutKey } from '@/lib/device'

import { focusSearchField } from '../searchField'

/**
 * El campo «Buscar ⌘K» del sidebar (diseño 08, D1 y D2). No se escribe en él: al entrar lleva a
 * Buscar y pasa el foco al campo grande, así que lo que se teclee va allí. Enseña lo que se está
 * buscando, con su × para vaciarlo, y se marca en índigo estando en Buscar.
 */
export function SidebarSearchField() {
  const navigate = useNavigate()
  const { pathname, query } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      query: typeof state.location.search.q === 'string' ? state.location.search.q : '',
    }),
  })
  const active = pathname === '/search'

  const goToSearch = () => {
    if (active) {
      focusSearchField()
      return
    }
    void navigate({ to: '/search' }).then(focusSearchField)
  }

  return (
    <div
      className={cn(
        'relative flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] border bg-card px-3.5 text-sm',
        active ? 'border-primary' : 'border-border hover:border-control',
      )}
    >
      <Search
        aria-hidden
        className={cn('size-4', active ? 'text-primary' : 'text-subtle-foreground')}
      />
      <input
        readOnly
        aria-label="Buscar"
        placeholder="Buscar"
        value={query}
        onFocus={goToSearch}
        onClick={goToSearch}
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-foreground outline-none placeholder:text-subtle-foreground"
      />
      {query ? (
        <button
          type="button"
          aria-label="Vaciar la búsqueda"
          onClick={() => {
            void navigate({ to: '/search', search: {}, replace: true }).then(focusSearchField)
          }}
          className="grid size-[18px] place-items-center rounded-full bg-control text-white outline-none hover:bg-subtle-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-2.5" strokeWidth={3} />
        </button>
      ) : (
        <kbd className="rounded-[5px] bg-secondary px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          {shortcutKey() === '⌘' ? '⌘K' : 'Ctrl K'}
        </kbd>
      )}
    </div>
  )
}
