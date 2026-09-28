import type { Range } from '../search'

/**
 * Un texto con sus coincidencias resaltadas (pantalla 13): `<mark>` en `brand-tint` con el texto
 * en `primary-strong`, radio 4 y 2 px a los lados. El lector de pantalla lee el texto seguido.
 */
export function Highlight({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  const parts = []
  let at = 0
  for (const [from, to] of ranges) {
    if (from > at) parts.push(text.slice(at, from))
    parts.push(
      <mark key={from} className="rounded bg-brand-tint px-0.5 text-primary-strong">
        {text.slice(from, to)}
      </mark>,
    )
    at = to
  }
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}
