import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  /** Línea pequeña sobre el título (la fecha en Inicio y Hoy). */
  eyebrow?: string
  /** Línea bajo el título (contadores en el detalle de lista). */
  subtitle?: string
  /** Delante del título (el icono de la lista). */
  leading?: ReactNode
  /** A la derecha del título (el avatar en Inicio). */
  trailing?: ReactNode
  /** Variante de detalle: fila superior con «‹ Volver» y, opcionalmente, el menú ···. */
  back?: { to: LinkProps['to']; label: string }
  menu?: ReactNode
}

/** Cabecera de pantalla (diseño, pantallas 2, 4 y 7). */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  leading,
  trailing,
  back,
  menu,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <div className="flex h-11 items-center justify-between">
          <BackLink {...back} />
          {menu}
        </div>
      )}

      {/* Con icono delante (detalle de lista) el menú de la derecha se centra con el título. */}
      <div
        className={cn('flex justify-between gap-4 px-1', leading ? 'items-center' : 'items-end')}
      >
        <div className="flex min-w-0 items-center gap-3.5 md:gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow && <p className="text-[13px] font-medium text-muted-foreground">{eyebrow}</p>}
            <h1
              className={cn('leading-[1.1] md:text-[32px]', back ? 'text-[28px]' : 'text-[30px]')}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground md:text-sm">{subtitle}</p>
            )}
          </div>
        </div>
        {trailing}
      </div>
    </header>
  )
}

/** «‹ Listas»: vuelta atrás de las pantallas de detalle, en `primary` (pantalla 4). */
export function BackLink({ to, label }: { to: LinkProps['to']; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-1 flex h-11 items-center gap-1 self-start pr-2 text-[15px] font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronLeft aria-hidden className="size-5" strokeWidth={2.4} />
      {label}
    </Link>
  )
}
