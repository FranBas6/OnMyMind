/**
 * Cómo se llama este dispositivo en los textos («Esta lista aún no está en este iPhone.», diseño
 * 10). Por el navegador: el iPad moderno se presenta como Mac, pero es táctil.
 */
export function thisDevice(): string {
  const agent = navigator.userAgent
  if (/iPhone|iPod/.test(agent)) return 'iPhone'
  if (agent.includes('iPad') || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1)) {
    return 'iPad'
  }
  if (/Android|Mobile/.test(agent)) return 'móvil'
  return 'ordenador'
}
