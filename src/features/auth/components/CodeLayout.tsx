import { ChevronLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface CodeLayoutProps {
  title: string
  description: ReactNode
  onBack: () => void
  children: ReactNode
}

/**
 * Pasos del código por email (diseño 11, K1–K10 y D4–D6): «‹ Volver», título y explicación, sin la
 * marca del acceso. En escritorio, la misma columna de 380 px centrada.
 */
export function CodeLayout({ title, description, onBack, children }: CodeLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[calc(env(safe-area-inset-top)+0.375rem)] pr-[max(env(safe-area-inset-right),1.75rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] pl-[max(env(safe-area-inset-left),1.75rem)] text-foreground md:justify-center md:py-10">
      <main className="mx-auto flex w-full max-w-[380px] flex-col gap-6 md:gap-7">
        <div className="-mx-2 flex h-11 items-center md:-mb-3 md:h-auto">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[15px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-8 md:text-sm"
          >
            <ChevronLeftIcon aria-hidden className="size-5" strokeWidth={2.2} />
            Volver
          </button>
        </div>
        <header className="flex flex-col gap-2">
          <h1 className="text-[26px] leading-[1.15] tracking-[-0.03em] md:text-[28px]">{title}</h1>
          <p className="text-[15px] leading-normal text-muted-foreground">{description}</p>
        </header>
        {children}
      </main>
    </div>
  )
}
