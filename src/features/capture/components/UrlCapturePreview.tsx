import { Link2, LoaderCircle, WifiOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { linkDomain, linkPath, type LinkMetadata, type LinkPreviewState } from '@/features/items'
import { formatCents } from '@/lib/money'

/**
 * La tarjeta de un enlace pegado en la captura (pantalla 9 y diseño 16, K1–K5, D7, D8): la imagen
 * de la página (64 px), su título y «Real Madrid CF · 100 €». Buscando, un esqueleto con el
 * dominio y «buscando…»; si la web no da nada, el dominio y la ruta junto al eslabón; sin red, el
 * dominio y que el resto llegará después.
 */
export function UrlCapturePreview({
  url,
  state,
  metadata,
}: {
  url: string
  state: LinkPreviewState
  metadata: LinkMetadata | null
}) {
  const [broken, setBroken] = useState(false)
  const domain = linkDomain(url)

  if (state === 'searching') {
    return (
      <Card label={`Buscando la página de ${domain}`}>
        <span className="grid size-16 shrink-0 place-items-center rounded-[12px] bg-fill">
          <LoaderCircle
            aria-hidden
            className="size-[18px] animate-spin text-primary"
            strokeWidth={2.4}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block h-3 w-4/5 rounded-md bg-fill" />
          <span className="mt-2 block h-3 w-1/2 rounded-md bg-fill" />
          <Meta>{domain} · buscando…</Meta>
        </span>
      </Card>
    )
  }

  const title = metadata?.title?.trim()
  const image = metadata?.image && !broken ? metadata.image : null
  const price = metadata?.price
  const site = metadata?.siteName?.trim()

  // La web no da nada, o no se ha podido mirar: el dominio y, debajo, la ruta o que llegará luego.
  if (!title && !image) {
    return (
      <Card label={`Enlace a ${domain}`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-fill text-muted-foreground">
          <Link2 aria-hidden className="size-[18px]" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-foreground">
            {domain}
          </span>
          {state === 'offline' ? (
            <Meta>
              <WifiOff aria-hidden className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate">
                Se guarda con el dominio. El resto, al volver la red.
              </span>
            </Meta>
          ) : (
            <Meta>{linkPath(url)}</Meta>
          )}
        </span>
      </Card>
    )
  }

  return (
    <Card label={title ?? domain}>
      {image ? (
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => {
            setBroken(true)
          }}
          className="size-16 shrink-0 rounded-[12px] bg-fill object-cover"
        />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-[12px] bg-fill text-muted-foreground">
          <Link2 aria-hidden className="size-[18px]" strokeWidth={2.2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14.5px] leading-[1.3] font-semibold text-foreground">
          {title ?? domain}
        </span>
        <Meta>
          {/* Con precio, la tienda y el precio (K1); sin él, la web y su dominio (K5). */}
          {price ? (
            <>
              <span className="truncate">{site ?? domain} ·</span>
              <b className="shrink-0 font-display font-extrabold text-foreground">
                {formatCents(price.cents, price.currency)}
              </b>
            </>
          ) : (
            <span className="truncate">{site ? `${site} · ${domain}` : domain}</span>
          )}
        </Meta>
      </span>
    </Card>
  )
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-3 rounded-[18px] border border-border p-3"
    >
      {children}
    </div>
  )
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="mt-[3px] flex min-w-0 items-center gap-[5px] text-[12.5px] whitespace-nowrap text-subtle-foreground">
      {children}
    </span>
  )
}
