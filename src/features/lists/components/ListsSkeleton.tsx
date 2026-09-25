import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const block = 'bg-skeleton motion-reduce:animate-none'

/**
 * Esqueleto de Inicio mientras cargan las listas (diseño 03 Inicio, D7): el bloque de
 * «En mente» y tarjetas con la forma de las de verdad, para que nada salte al llegar los datos.
 * Misma rejilla que `ListGrid`.
 */
export function ListsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando tus listas"
      className="flex flex-col gap-[18px] md:gap-7"
    >
      <Skeleton className={cn(block, 'h-[110px] rounded-3xl md:h-[124px]')} />
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 md:gap-4 @min-[820px]:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div
              key={key}
              className={cn(
                'flex flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-4',
                key > 3 && 'hidden @min-[820px]:flex',
              )}
            >
              <Skeleton className={cn(block, 'size-10 rounded-[13px]')} />
              <div>
                <Skeleton className={cn(block, 'h-3.5 w-[62%] rounded-[7px]')} />
                <Skeleton className={cn(block, 'mt-2 h-2.5 w-[38%] rounded-[5px]')} />
              </div>
              <Skeleton className={cn(block, 'h-2.5 w-[48%] rounded-[5px]')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
