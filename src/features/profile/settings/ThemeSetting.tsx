import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

import { useUpdateSettings } from '../hooks/useProfileMutations'
import type { Theme } from '../schemas'

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
] as const

/**
 * «Apariencia» de Perfil (pantalla 14 y diseño 09): control segmentado Claro / Oscuro / Sistema.
 * Cambia el tema al momento (next-themes, que lo recuerda en este navegador para pintar sin
 * parpadeo al abrir) y lo guarda en el perfil, que es lo que manda en el resto de dispositivos
 * (`ThemeSync`).
 */
export function ThemeSetting() {
  const { theme = 'system', setTheme } = useTheme()
  const updateSettings = useUpdateSettings()
  const choose = (value: Theme) => {
    setTheme(value)
    updateSettings.mutate({ theme: value })
  }

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
              choose(value)
            }}
            className={cn(
              'h-9 flex-1 rounded-[11px] text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'bg-card font-bold shadow-[0_1px_4px_rgb(28_27_34/0.08)]'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
