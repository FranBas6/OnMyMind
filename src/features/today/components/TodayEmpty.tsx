import { cn } from '@/lib/utils'

/**
 * Hoy sin nada (variante `hoyVacio` de la pantalla 7): la nube con el check en `brand-tint` y
 * `primary`, «Nada en mente para hoy.» y «Disfrútalo.». Otro día vacío usa el mismo con sus textos
 * (diseño 17, C3). Solo, en el centro de la pantalla; `compact`, con lo hecho o lo apuntado hoy
 * debajo, arriba y con su alto, para que eso se vea sin bajar (Fran, 2026-10-30).
 */
export function TodayEmpty({
  title = 'Nada en mente para hoy.',
  body = 'Disfrútalo.',
  compact = false,
}: {
  title?: string
  body?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 px-6 text-center',
        compact ? 'py-6 md:py-8' : 'flex-1 justify-center pb-10 md:pb-15',
      )}
    >
      <svg aria-hidden viewBox="0 0 56 56" className="size-18">
        <circle cx="28" cy="26" r="20" className="fill-brand-tint" />
        <circle cx="14" cy="46" r="4.5" className="fill-brand-tint" />
        <circle cx="7" cy="53" r="2.5" className="fill-brand-tint" />
        <polyline
          points="19,26 25.5,32.5 37,20"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
      </svg>
      <p className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]">
        {title}
      </p>
      <p className="-mt-2 text-[15px] text-muted-foreground">{body}</p>
    </div>
  )
}
