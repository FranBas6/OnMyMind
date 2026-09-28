import {
  LIST_COLOR_BG,
  LIST_COLOR_LABEL,
  LIST_COLOR_ORDER,
  LIST_COLOR_RING,
  type ListColor,
} from '@/lib/listColors'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: ListColor
  onChange: (color: ListColor) => void
}

/**
 * Siete círculos de 36 px (diseño 04 Listas). El elegido lleva un hueco de 3 px del color de fondo
 * y un anillo de 2 px de su propio color. El «+» de color libre llega en la fase 3.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2.5 px-0.5">
      {LIST_COLOR_ORDER.map((color) => {
        const selected = color === value
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LIST_COLOR_LABEL[color]}
            onClick={() => {
              onChange(color)
            }}
            className={cn(
              'size-9 rounded-full outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-transform',
              LIST_COLOR_BG[color],
              selected && [
                'ring-2 ring-offset-[3px] ring-offset-background',
                LIST_COLOR_RING[color],
              ],
            )}
          />
        )
      })}
    </div>
  )
}
