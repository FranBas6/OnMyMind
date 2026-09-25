import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
] as const

/**
 * «Apariencia» de Perfil (diseño, pantalla 14): control segmentado Claro / Oscuro / Sistema.
 * Provisional: next-themes lo guarda en este navegador; en 1.13 se guardará también en el perfil.
 */
export function ThemeSelector() {
  const { theme = 'system', setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      className="flex gap-1.5 rounded-[14px] bg-secondary p-1"
    >
      {THEME_OPTIONS.map(({ value, label }) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setTheme(value)
            }}
            className={cn(
              'h-9 flex-1 rounded-[11px] text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected && 'bg-card shadow-[0_1px_4px_rgb(28_27_34/0.08)]',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
