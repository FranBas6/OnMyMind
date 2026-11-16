import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { BottomSheet } from '@/components/BottomSheet'
import { PANEL_WIDTH, useLayoutWidths } from '@/components/layout/layoutWidths'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useSidePanel } from '@/components/layout/sidePanel'

import type { Item } from '../types'
import { ItemDetail, type ItemDetailProps } from './ItemDetail'

type ItemSheetProps = Omit<ItemDetailProps, 'item'> & {
  /** El ítem abierto (`?item=`), o nada si está cerrado. */
  item: Item | undefined
}

/**
 * Contenedor del detalle de un ítem. En móvil, hoja casi a pantalla completa (pantalla 11). En
 * escritorio, panel de 420 px en la columna derecha de `AppShell` (diseño 06, D1): la lista
 * sigue a la vista y se puede usar, y Escape o la X lo cierran.
 */
export function ItemSheet({ item, ...props }: ItemSheetProps) {
  const panel = useSidePanel()
  // Al cerrarse, la hoja se anima hacia abajo: sigue pintando el último ítem hasta desaparecer.
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)

  if (props.isDesktop) {
    if (!item || !panel) return null
    return createPortal(<DesktopPanel item={item} {...props} />, panel)
  }

  return (
    <BottomSheet
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={shown ? `Detalle de «${shown.title}»` : 'Detalle'}
      className="h-[86dvh] gap-0 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
    >
      {shown && (
        <div className="-mx-[22px] min-h-0 flex-1 overflow-y-auto px-[22px] pt-3.5">
          <ItemDetail key={shown.id} item={shown} {...props} />
        </div>
      )}
    </BottomSheet>
  )
}

function DesktopPanel({ item, ...props }: ItemDetailProps) {
  const { onClose } = props
  const widths = useLayoutWidths()

  // Escape cierra el panel, salvo que venga de un menú, popover o diálogo abierto encima: esos
  // se cierran solos con su propio Escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) {
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="relative h-dvh" style={{ width: widths.panel }}>
      {/* Su borde izquierdo se arrastra (Fran, 2026-11-16): fuera del scroll, para que no se mueva. */}
      <ResizeHandle
        label="Ancho del panel de detalle"
        edge="start"
        value={widths.panel}
        min={PANEL_WIDTH.min}
        max={widths.panelMax}
        onChange={widths.setPanel}
        onReset={() => {
          widths.setPanel(PANEL_WIDTH.initial)
        }}
      />
      <section
        aria-label={`Detalle de «${item.title}»`}
        className="h-dvh w-full overflow-y-auto border-l border-border bg-card px-7 pt-6 pb-7 shadow-panel"
      >
        <ItemDetail key={item.id} item={item} {...props} />
      </section>
    </div>
  )
}
