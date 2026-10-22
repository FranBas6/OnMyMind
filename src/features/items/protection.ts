import type { Item } from './types'

/**
 * Lo puro de proteger una nota (5.7, diseño 26): por qué no se puede, si no se puede.
 *
 * - **En una lista compartida** (C9), los demás no tienen tu clave.
 * - **Con fotos o enlaces** (C6d): de momento, una nota protegida es solo texto.
 * - **Con documentos** (diseño 29, P2): no se protegen con la clave.
 */

/** «Fran», «Fran y Bea», «Fran, Bea y Luis». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`
}

type ProtectableItem = Pick<Item, 'images' | 'imagePath' | 'imageUrl' | 'url' | 'links' | 'files'>

/** Cuántas fotos, enlaces y documentos tiene: los que hay que quitar para protegerla. */
function mediaCount(item: ProtectableItem) {
  const photos = item.images.length > 0 ? item.images.length : item.imagePath ? 1 : 0
  const links = item.links.length > 0 ? item.links.length : item.url ? 1 : 0
  // La imagen de la web va con su enlace: quitando el enlace, se va.
  return {
    photos,
    links: links || (item.imageUrl && photos === 0 ? 1 : 0),
    files: item.files.length,
  }
}

const count = (n: number, one: string, many: string) =>
  n === 1 ? `1 ${one}` : `${String(n)} ${many}`

/** Por qué esta nota no se puede proteger, o `null` si se puede. `others`: con quién la compartes. */
export function protectionBlock(item: ProtectableItem, others: readonly string[]): string | null {
  if (others.length > 0) {
    const verb = others.length === 1 ? 'no tiene' : 'no tienen'
    return `En una lista compartida no se puede proteger: ${joinNames(others)} ${verb} tu clave.`
  }
  const { photos, links, files } = mediaCount(item)
  if (photos === 0 && links === 0 && files === 0) return null
  // Solo documentos (diseño 29, P2): no se protegen con la clave.
  if (photos === 0 && links === 0) {
    const them = files === 1 ? 'quítalo' : 'quítalos'
    return `Esta nota tiene ${count(files, 'documento', 'documentos')}. Los documentos no se protegen con la clave: ${them} antes; si los necesitas, guárdalos en otra nota sin proteger.`
  }
  const parts = [
    photos > 0 && count(photos, 'foto', 'fotos'),
    links > 0 && count(links, 'enlace', 'enlaces'),
    files > 0 && count(files, 'documento', 'documentos'),
  ].filter(Boolean)
  const joined =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${String(parts.at(-1))}` : parts.join('')
  const remove =
    links > 0 || files > 0 || parts.length > 1 ? 'quítalos' : photos === 1 ? 'quítala' : 'quítalas'
  return `Esta nota tiene ${joined}. De momento, una nota protegida es solo texto: ${remove} para protegerla.`
}
