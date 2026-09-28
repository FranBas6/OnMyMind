import { Check, Share, SquarePlus, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { usePwa } from '@/hooks/usePwa'
import { readInstallHint, shouldAutoShow, writeInstallHint } from '@/lib/installHint'

const STEPS: readonly { icon: LucideIcon; text: ReactNode }[] = [
  {
    icon: Share,
    text: (
      <>
        Toca <b>Compartir</b> en la barra de abajo
      </>
    ),
  },
  {
    icon: SquarePlus,
    text: (
      <>
        Elige <b>Añadir a pantalla de inicio</b>
      </>
    ),
  },
  {
    icon: Check,
    text: (
      <>
        Toca <b>Añadir</b> arriba a la derecha
      </>
    ),
  },
]

/**
 * «Instalar en el iPhone» (diseño 10, I1 e I2): solo en Safari de iOS sin la app instalada. Sale
 * sola la primera vez que entras (y otra, a los siete días, si dijiste «Lo haré después»); desde
 * Perfil · App se abre cuando quieras. Tres pasos con los iconos del sistema.
 *
 * El diseño dibuja además una flecha y un halo sobre el botón Compartir de la barra de Safari,
 * pero la barra queda fuera de la página y ahí no se puede pintar: la flecha va al pie de la hoja,
 * apuntando hacia él.
 */
export function InstallHint() {
  const pwa = usePwa()
  const { canInstall, installOpen, openInstall, closeInstall } = pwa
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current || !canInstall) return
    decided.current = true
    const record = readInstallHint()
    if (!shouldAutoShow(record, new Date())) return
    writeInstallHint({ ...record, shown: record.shown + 1 })
    openInstall()
  }, [canInstall, openInstall])

  if (!canInstall) return null

  return (
    <BottomSheet
      open={installOpen}
      onOpenChange={(open) => {
        if (!open) closeInstall('later')
      }}
      title="Instalar en el iPhone"
      className="gap-4 pb-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <img
            src="/logos/svg/omm-app-icon.svg"
            alt=""
            className="size-14 shrink-0 rounded-[14px]"
          />
          <div>
            <p className="font-display text-[22px] leading-[1.15] font-extrabold tracking-[-0.02em]">
              Instalar en el iPhone
            </p>
            <p className="mt-[3px] text-[13px] text-muted-foreground">
              Un icono en tu pantalla de inicio.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => {
            closeInstall('later')
          }}
          className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-fill text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      <p className="text-[15px] leading-normal">
        Abre como una app, funciona sin conexión y, más adelante, te podrá avisar.
      </p>
      <ol className="flex flex-col gap-0.5 rounded-2xl border border-border-soft bg-background p-1.5">
        {STEPS.map(({ icon: Icon, text }, index) => (
          <li key={index} className="flex h-13 items-center gap-3.5 px-2.5">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-tint font-display text-[13px] font-bold text-primary-strong"
            >
              {index + 1}
            </span>
            <Icon aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={2} />
            <span className="text-[15px] leading-[1.3]">{text}</span>
          </li>
        ))}
      </ol>
      <div className="flex h-11 items-center justify-between text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            closeInstall('never')
          }}
          className="h-11 pr-2 text-subtle-foreground outline-none hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          No volver a mostrar
        </button>
        <button
          type="button"
          onClick={() => {
            closeInstall('later')
          }}
          className="h-11 pl-2 text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Lo haré después
        </button>
      </div>
      {/* Hacia el botón Compartir, que está en la barra de Safari, justo debajo. */}
      <span
        aria-hidden
        className="mx-auto -mb-1 size-0 border-x-[12px] border-t-[12px] border-x-transparent border-t-primary"
      />
    </BottomSheet>
  )
}
