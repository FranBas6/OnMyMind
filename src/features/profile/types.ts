import type { Settings } from './schemas'

export type { Settings, SettingsPatch, Theme } from './schemas'

/** Tu perfil (03 §profiles): el nombre que se muestra y los ajustes, ya leídos con sus valores por defecto. */
export interface Profile {
  id: string
  displayName: string | null
  avatarUrl: string | null
  settings: Settings
  /** Si `settings.theme` está guardado de verdad (las cuentas de antes de 1.13 no lo tienen). */
  themeStored: boolean
}
