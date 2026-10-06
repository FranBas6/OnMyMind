/** Cómo acabó «Invitar» o «Enviar otra vez»: compartido, copiado o cancelado por quien comparte. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled'

/**
 * Manda el enlace con la hoja del sistema (WhatsApp, AirDrop…; diseño 20, S3). Si el navegador no
 * la tiene (casi todos los de escritorio) o no la deja abrir, lo copia. Safari solo abre la hoja
 * justo después de un toque: si antes hubo que esperar a la red, puede negarse, y entonces la hoja
 * de compartir ya enseña el enlace con «Enviar otra vez».
 */
export async function shareInvite(url: string, text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(`${text}\n${url}`)) ? 'copied' : 'cancelled'
}

/** Copia al portapapeles; `false` si el navegador no deja. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** La dirección sin `https://`, como se enseña en la hoja (S4): `onmymind.app/i/k7Q2xp`. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}
