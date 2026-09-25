/**
 * Céntimos → texto en español: «627 €», «9,99 €». Sin decimales cuando son cero, como en el
 * diseño («3 pendientes · 627 €»).
 */
export function formatCents(cents: number, currency = 'EUR'): string {
  const hasDecimals = cents % 100 !== 0
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(cents / 100)
}
