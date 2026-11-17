import { namesOf } from '@/features/sharing/copy'

/** Los textos de las listas ocultas (5.8, diseño 27). */

/** Al confirmar «Ocultar» una compartida (D7b): «Solo se oculta para ti. Fran la sigue viendo…». */
export function hideSharedNote(others: readonly { displayName: string | null }[]): string {
  const verb = others.length === 1 ? 'la sigue viendo' : 'la siguen viendo'
  return `Solo se oculta para ti. ${namesOf(others)} ${verb} en sus listas.`
}

/** Dentro de una oculta compartida (D7): «Solo está oculta para ti. Fran la ve en sus listas…». */
export function hiddenSharedNote(others: readonly { displayName: string | null }[]): string {
  const verb = others.length === 1 ? 'la ve' : 'la ven'
  return `Solo está oculta para ti. ${namesOf(others)} ${verb} en sus listas, como siempre.`
}

/** La franja de «Listas ocultas» desbloqueadas (D4 y E3). */
export function hiddenBandLabel(minutes: number, isDesktop: boolean): string {
  return `Desbloqueadas · se bloquean solas en ${minutes} min${isDesktop ? ' o al cerrar la pestaña' : ''}`
}

/** El aviso al ocultar (D1d): sin el nombre, que se vería en la pantalla. */
export const HIDDEN_TOAST = 'Lista oculta'

/** Al mostrarla (D5c). */
export function shownToast(name: string): string {
  return `«${name}» vuelve a Mis listas`
}
