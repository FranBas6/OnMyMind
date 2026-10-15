import { Archive } from 'lucide-react'
import { useId } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { InboxMark } from '@/features/capture'
import { hasPrices, ListScope } from '@/features/items'

import type { SearchSection as Section } from '../search'
import { SearchResultRow } from './SearchResultRow'

/**
 * Los resultados de una lista: la etiqueta de sección (el cuadrado en su color o, en «En mente»,
 * el símbolo; el texto en `muted` por AA, como en Hoy) con la píldora «Archivada» si lo está
 * (diseño 08, B4), y sus filas.
 */
export function SearchSection({ section, now }: { section: Section; now: Date }) {
  const { list, results } = section
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h2
        id={labelId}
        className="flex items-center gap-2 px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        {list.kind === 'inbox' ? (
          <InboxMark className="size-3" />
        ) : (
          // Su cuadrado a 20 px (diseño 28); archivada, sin color.
          <ListIcon
            name={list.name}
            color={list.color}
            icon={list.icon}
            size="chip"
            dimmed={list.archivedAt !== null}
          />
        )}
        {list.name}
        {list.archivedAt && (
          <span className="inline-flex items-center gap-1 rounded-[7px] bg-fill px-2 py-0.5 text-[11px] font-semibold tracking-normal text-subtle-foreground normal-case">
            <Archive aria-hidden className="size-3" strokeWidth={2.2} />
            Archivada
          </span>
        )}
      </h2>
      <ListScope list={list} prices={hasPrices(results.map((result) => result.item))}>
        <ul aria-label={list.name} className="flex flex-col gap-2">
          {results.map((result) => (
            <SearchResultRow key={result.item.id} result={result} now={now} />
          ))}
        </ul>
      </ListScope>
    </section>
  )
}
