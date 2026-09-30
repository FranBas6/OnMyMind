/** Los siete colores de lista: se guarda el nombre del token, no el hex (documento 06). */
export const LIST_COLORS = ['coral', 'amber', 'teal', 'blue', 'pink', 'green', 'indigo'] as const
export type ListColor = (typeof LIST_COLORS)[number]

/**
 * Clase de fondo de cada color. Tailwind solo genera las clases que ve escritas enteras en el
 * código, así que `bg-list-${color}` no funcionaría: hace falta este mapa literal.
 */
export const LIST_COLOR_BG: Record<ListColor, string> = {
  coral: 'bg-list-coral',
  amber: 'bg-list-amber',
  teal: 'bg-list-teal',
  blue: 'bg-list-blue',
  pink: 'bg-list-pink',
  green: 'bg-list-green',
  indigo: 'bg-list-indigo',
}

/** Anillo del color elegido en el selector (diseño 04 Listas: hueco de 3 px y anillo de 2 px). */
export const LIST_COLOR_RING: Record<ListColor, string> = {
  coral: 'ring-list-coral',
  amber: 'ring-list-amber',
  teal: 'ring-list-teal',
  blue: 'ring-list-blue',
  pink: 'ring-list-pink',
  green: 'ring-list-green',
  indigo: 'ring-list-indigo',
}

/** Nombre de cada color para lectores de pantalla. */
export const LIST_COLOR_LABEL: Record<ListColor, string> = {
  coral: 'Coral',
  amber: 'Ámbar',
  teal: 'Verde azulado',
  blue: 'Azul',
  pink: 'Rosa',
  green: 'Verde',
  indigo: 'Índigo',
}

/** Orden del selector de color (diseño 04 Listas): índigo primero, que es el de la marca. */
export const LIST_COLOR_ORDER: readonly ListColor[] = [
  'indigo',
  'coral',
  'amber',
  'teal',
  'blue',
  'pink',
  'green',
]

/** Texto e iconos en el color de la lista (la ilustración del estado vacío, diseño 05). */
export const LIST_COLOR_TEXT: Record<ListColor, string> = {
  coral: 'text-list-coral',
  amber: 'text-list-amber',
  teal: 'text-list-teal',
  blue: 'text-list-blue',
  pink: 'text-list-pink',
  green: 'text-list-green',
  indigo: 'text-list-indigo',
}

/**
 * Fondo tenue del color de la lista: el cuadrado del estado vacío (diseño 05, coral al 13 % sobre
 * blanco = #FDECEA). En oscuro el diseño repite el claro, que deslumbra: se sube al 20 % del color
 * sobre el fondo oscuro.
 */
export const LIST_COLOR_TINT: Record<ListColor, string> = {
  coral: 'bg-list-coral/13 dark:bg-list-coral/20',
  amber: 'bg-list-amber/13 dark:bg-list-amber/20',
  teal: 'bg-list-teal/13 dark:bg-list-teal/20',
  blue: 'bg-list-blue/13 dark:bg-list-blue/20',
  pink: 'bg-list-pink/13 dark:bg-list-pink/20',
  green: 'bg-list-green/13 dark:bg-list-green/20',
  indigo: 'bg-list-indigo/13 dark:bg-list-indigo/20',
}

/** Borde en el color de la lista: el checkbox de las filas de Hoy (pantalla 7). */
export const LIST_COLOR_BORDER: Record<ListColor, string> = {
  coral: 'border-list-coral',
  amber: 'border-list-amber',
  teal: 'border-list-teal',
  blue: 'border-list-blue',
  pink: 'border-list-pink',
  green: 'border-list-green',
  indigo: 'border-list-indigo',
}

/**
 * Fondo del icono de una sublista (diseño 12, S1): el color de su lista al 18 % (al 10 % si está
 * pausada). En oscuro, algo más para que no se pierda sobre la superficie.
 */
export const LIST_COLOR_SUBLIST: Record<ListColor, { active: string; paused: string }> = {
  coral: { active: 'bg-list-coral/18 dark:bg-list-coral/24', paused: 'bg-list-coral/10' },
  amber: { active: 'bg-list-amber/18 dark:bg-list-amber/24', paused: 'bg-list-amber/10' },
  teal: { active: 'bg-list-teal/18 dark:bg-list-teal/24', paused: 'bg-list-teal/10' },
  blue: { active: 'bg-list-blue/18 dark:bg-list-blue/24', paused: 'bg-list-blue/10' },
  pink: { active: 'bg-list-pink/18 dark:bg-list-pink/24', paused: 'bg-list-pink/10' },
  green: { active: 'bg-list-green/18 dark:bg-list-green/24', paused: 'bg-list-green/10' },
  indigo: { active: 'bg-list-indigo/18 dark:bg-list-indigo/24', paused: 'bg-list-indigo/10' },
}
