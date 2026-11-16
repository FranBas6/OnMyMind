import { createLucideIcon } from 'lucide-react'

/** Las tres líneas de la sublista (diseño 12), con el trazo de los iconos de lucide. */
export const SublistGlyph = createLucideIcon('Sublist', [
  ['path', { d: 'M4 7h16', key: 'top' }],
  ['path', { d: 'M4 12h16', key: 'middle' }],
  ['path', { d: 'M4 17h9', key: 'bottom' }],
])
