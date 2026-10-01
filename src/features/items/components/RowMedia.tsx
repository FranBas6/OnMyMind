import { Link2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { usePhotoSrc } from '../hooks/usePhoto'
import { linkDomain } from '../links'
import { hasThumb } from '../photos'
import type { Item } from '../types'

/**
 * La miniatura de 44 px de la fila, tras el control (diseño 15, L1 y D1; base: diseño 13, I1). Si
 * la imagen de la web ya no carga, queda el cuadrado vacío en `fill`, sin icono roto.
 */
export function RowThumb({ item, className }: { item: Item; className?: string }) {
  const { src } = usePhotoSrc(item, 'thumb')
  const [broken, setBroken] = useState<string | null>(null)
  if (!hasThumb(item)) return null
  return (
    <span
      aria-hidden
      className={cn('block size-11 shrink-0 overflow-hidden rounded-[12px] bg-fill', className)}
    >
      {src && broken !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => {
            setBroken(src)
          }}
          className="size-full object-cover"
        />
      )}
    </span>
  )
}

/** «🔗 shop.realmadrid.com» en la meta de la fila (diseño 15, L1 y L2). */
export function LinkMeta({ url, className }: { url: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <Link2 aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      <span className="sr-only">Enlace: </span>
      <span className="truncate">{linkDomain(url)}</span>
    </span>
  )
}
