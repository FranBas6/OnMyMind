import { Search, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { SEARCH_FIELD_ID } from '../searchField'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  isDesktop: boolean
}

/**
 * El campo de Buscar (pantalla 13 y diseño 08): lupa índigo, «Buscar en todas tus listas» y, con
 * texto, la × para vaciarlo. Móvil: 50 px, radio 16. Escritorio: 56 px, radio 18, con la pista
 * «Esc». A 16 px para que Safari en iOS no amplíe la página al enfocarlo. Se enfoca solo al entrar.
 */
export function SearchField({ value, onChange, onKeyDown, isDesktop }: SearchFieldProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-[1.5px] border-border bg-card focus-within:border-primary',
        isDesktop ? 'h-14 rounded-[18px] px-5' : 'h-[50px] rounded-2xl px-4',
      )}
    >
      <Search aria-hidden className="size-[18px] shrink-0 text-primary" strokeWidth={2.4} />
      <input
        id={SEARCH_FIELD_ID}
        type="search"
        autoFocus
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Buscar en todas tus listas"
        placeholder="Buscar en todas tus listas"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Vaciar la búsqueda"
          onClick={() => {
            onChange('')
            document.getElementById(SEARCH_FIELD_ID)?.focus()
          }}
          className="relative grid size-[22px] shrink-0 place-items-center rounded-full bg-control text-white outline-none before:absolute before:-inset-2.5 before:content-[''] hover:bg-subtle-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-3" strokeWidth={3} />
        </button>
      )}
      {isDesktop && (
        <kbd className="rounded-md bg-fill px-2 py-[3px] font-sans text-xs text-muted-foreground">
          Esc
        </kbd>
      )}
    </div>
  )
}
