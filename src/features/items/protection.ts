import type { Item } from './types'

/**
 * Lo puro de proteger una nota (5.7, diseño 26): por qué no se puede, si no se puede.
 *
 * - **En una lista compartida** (C9), los demás no tienen tu clave.
 * - **Con fotos o enlaces** (C6d): de momento, una nota protegida es solo texto.
 */

/** «Fran», «Fran y Bea», «Fran, Bea y Luis». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`
}

/** Cuántas fotos y enlaces tiene: los que hay que quitar para protegerla. */
function mediaCount(item: Pick<Item, 'images' | 'imagePath' | 'imageUrl' | 'url' | 'links'>) {
  const photos = item.images.length > 0 ? item.images.length : item.imagePath ? 1 : 0
  const links = item.links.length > 0 ? item.links.length : item.url ? 1 : 0
  // La imagen de la web va con su enlace: quitando el enlace, se va.
  return { photos, links: links || (item.imageUrl && photos === 0 ? 1 : 0) }
}

/** Por qué esta nota no se puede proteger, o `null` si se puede. `others`: con quién la compartes. */
export function protectionBlock(
  item: Pick<Item, 'images' | 'imagePath' | 'imageUrl' | 'url' | 'links'>,
  others: readonly string[],
): string | null {
  if (others.length > 0) {
    const verb = others.length === 1 ? 'no tiene' : 'no tienen'
    return `En una lista compartida no se puede proteger: ${joinNames(others)} ${verb} tu clave.`
  }
  const { photos, links } = mediaCount(item)
  if (photos === 0 && links === 0) return null
  const parts = [
    photos > 0 && (photos === 1 ? '1 foto' : `${photos} fotos`),
    links > 0 && (links === 1 ? '1 enlace' : `${links} enlaces`),
  ].filter(Boolean)
  const remove = links > 0 ? 'quítalos' : photos === 1 ? 'quítala' : 'quítalas'
  return `Esta nota tiene ${parts.join(' y ')}. De momento, una nota protegida es solo texto: ${remove} para protegerla.`
}
