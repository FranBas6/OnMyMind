import { useTheme } from 'next-themes'
import { useEffect, useEffectEvent, useRef } from 'react'

import { useProfile } from '../hooks/useProfile'
import { useUpdateSettings } from '../hooks/useProfileMutations'
import { THEMES, type Theme } from '../schemas'

const isTheme = (value: string | undefined): value is Theme =>
  THEMES.some((theme) => theme === value)

/**
 * El tema viaja con la cuenta (08 B.14): cuando llega el perfil, o cambia en otro dispositivo, se
 * aplica aquí. next-themes lo sigue guardando en este navegador para pintar sin parpadeo antes de
 * que llegue el perfil; el perfil manda en cuanto llega. Si el perfil aún no tiene tema (cuentas
 * de antes de 1.13), se guarda el de este navegador en vez de pisarlo con «Sistema».
 */
export function ThemeSync() {
  const profile = useProfile()
  const { theme, setTheme } = useTheme()
  const updateSettings = useUpdateSettings()
  const migrated = useRef(false)
  const stored = profile.data?.themeStored
  const remote = profile.data?.settings.theme

  // Lee el tema local y guarda sin que cambiarlo aquí vuelva a lanzar el efecto: el efecto solo
  // depende de lo guardado en el perfil (el tema local lo cambia `ThemeSetting`).
  const apply = useEffectEvent((isStored: boolean, value: Theme) => {
    if (isStored) {
      setTheme(value)
    } else if (!migrated.current && isTheme(theme)) {
      migrated.current = true
      updateSettings.mutate({ theme })
    }
  })

  useEffect(() => {
    if (stored !== undefined && remote !== undefined) apply(stored, remote)
  }, [stored, remote])

  return null
}
