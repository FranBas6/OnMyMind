import type { ItemKind, ItemStatus } from './status'
import type { Priority } from './fields'

export type { ItemKind, ItemStatus } from './status'
export type { Priority, TaskFields } from './fields'

/**
 * Un ítem de cualquier lista. Los campos promocionados de la tabla (`due_at`, `recurrence`…) van
 * como columnas; de `fields` (JSONB) solo se lee lo que el tipo usa hoy: la prioridad de las
 * tareas. El resto de campos llega con el detalle de cada tipo.
 */
export interface Item {
  id: string
  listId: string
  /** El tipo es del ítem, no de la lista (ADR-009): una lista puede mezclar tipos. */
  kind: ItemKind
  /** La sublista en la que está (ADR-010), de su misma lista; `null` si está suelta en la lista. */
  parentId: string | null
  /**
   * Una sublista «para elegir una» (5.1, diseño 24): sus opciones cuentan como una sola cosa y en
   * el total suma la más barata. Solo en sublistas.
   */
  chooseOne: boolean
  /**
   * La opción elegida, de dentro: la preferida, la que cuenta en el total. Elegirla no la compra ni
   * la termina (Fran, 2026-10-11).
   */
  chosenId: string | null
  title: string
  notes: string | null
  status: ItemStatus
  /** Solo en tareas. */
  priority: Priority | null
  /** Fecha límite (tareas) o fecha del evento. */
  dueAt: Date | null
  allDay: boolean
  recurrence: string | null
  position: number
  /** La rellena el trigger al pasar a un estado final. */
  completedAt: Date | null
  createdAt: Date
  /** De qué «En mente» salió y cuándo (trigger `items_track_inbox`); `null` si no viene de una. */
  leftInboxId: string | null
  leftInboxAt: Date | null
  /** Su enlace (2a.6, diseño 15), de cualquier tipo. */
  url: string | null
  /** El título de la página: `null` si aún no se ha buscado; `''` si la página no da ninguno. */
  urlTitle: string | null
  /** La imagen de la página enlazada («De la web»), sin descargar. */
  imageUrl: string | null
  /** Su foto propia en Storage (`item-images`); si la hay, manda sobre `imageUrl`. */
  imagePath: string | null
  /** El nombre de la web del enlace (`og:site_name`): en una compra, la tienda (2.1). */
  urlSite: string | null
  /** El precio de una compra, en céntimos (2.1, diseño 16). Solo lo tienen las compras. */
  priceCents: number | null
  /** ISO 4217; el total de la lista solo suma euros. */
  currency: string
  /** De dónde salió el precio actual: escrito a mano o traído de la web. */
  priceSource: PriceSource | null
  /** El precio de antes, para la variación («↓ 8 %»). Lo pone el trigger, no el cliente. */
  previousPriceCents: number | null
  /** Cuándo se puso o se miró el precio («de la web · hoy»). Lo pone el trigger al cambiarlo. */
  priceCheckedAt: Date | null
  /**
   * Las tiendas de una compra con más de una (2.2b, diseño 19), por su orden. Vacío con una sola
   * tienda o ninguna: entonces el enlace y el precio son los del ítem, como en la 2.1.
   */
  links: ItemLink[]
  /**
   * Sus fotos propias, por su orden (4.5, diseño 23, D): hasta 10. La primera es `imagePath`, la de
   * la miniatura de la fila; la mantiene el trigger `item_images_sync`.
   */
  images: ItemImage[]
  /** La tienda de la que sale el precio: la más barata o, comprada, donde se compró. */
  priceLinkId: string | null
  /** Su nombre («MediaMarkt»), para «En MediaMarkt, la más barata de 3». */
  priceStore: string | null
  /** Si el precio se mira solo cada mañana (3.8). Con varias tiendas, cuenta el de cada una. */
  priceTracking: PriceTracking
  /**
   * Quién lo añadió y quién lo completó (3.3): en una lista compartida, la inicial del otro. `null`
   * en lo que aún no ha vuelto del servidor (lo acabas de hacer tú).
   */
  createdBy: string | null
  completedBy: string | null
}

/** Una foto propia de una cosa (`item_images`): su archivo en Storage y su sitio. */
export interface ItemImage {
  id: string
  path: string
  position: number
}

/** Una tienda de una compra (`item_links`): su enlace y su precio, de la web o a mano. */
export interface ItemLink {
  id: string
  url: string
  /** Como en el ítem: `null` es que aún no se ha buscado; `''`, que la página no dio nada. */
  urlTitle: string | null
  urlSite: string | null
  priceCents: number | null
  currency: string
  priceSource: PriceSource | null
  priceCheckedAt: Date | null
  priceTracking: PriceTracking
  position: number
}

/**
 * `manual`: escrito a mano; `web`: de la página, porque se pegó el enlace o se pidió; `auto`: mirado
 * solo cada mañana (3.8).
 */
export type PriceSource = 'manual' | 'web' | 'auto'

/**
 * Si el precio se mira solo (3.8): `on`, la tienda lo dio alguna vez y se mira cada mañana;
 * `stopped`, dejó de darlo tres mañanas seguidas («Ya no se puede seguir»); `null`, nunca lo dio.
 */
export type PriceTracking = 'on' | 'stopped' | null

/**
 * Algo que salió de «En mente» y vive ya en otra lista: la inbox lo enseña tachado en su «Fuera
 * de la cabeza», con «movida a Casa · lunes» (diseño 05).
 */
export interface MovedItem {
  id: string
  title: string
  listName: string
  movedAt: Date
}

/** Lo que se puede cambiar de un ítem desde su detalle, campo a campo. */
export interface ItemPatch {
  title?: string
  notes?: string | null
  priority?: Priority | null
  dueAt?: Date | null
  /**
   * Un evento (2.4): con `allDay`, `dueAt` se guarda tal cual, con su hora (o a las 00:00 si es de
   * todo el día). Sin él, la fecha límite de una tarea: el día a las 00:00, de día entero.
   */
  allDay?: boolean
  status?: ItemStatus
  /** Cambiar el tipo (fila «Tipo», `changeKindPatch`): llega con su estado traducido. */
  kind?: ItemKind
  /** «Elegir una» y «Dejar de elegir una» en una sublista (5.1); dejarlo olvida la elegida. */
  chooseOne?: boolean
  /** «Elegir esta» (o quitar la elección) en una sublista «para elegir una». */
  chosenId?: string | null
  /** Se quita al pasar a un tipo que no la usa (y vuelve si el cambio falla). */
  recurrence?: string | null
  /**
   * El enlace y la imagen de la web (2a.6): se guardan como el resto, campo a campo. Las fotos
   * propias van aparte, en `item_images` (4.5).
   */
  url?: string | null
  urlTitle?: string | null
  imageUrl?: string | null
  urlSite?: string | null
  /** El precio va siempre con su origen (y su moneda, si viene de la web): el trigger los copia. */
  priceCents?: number | null
  currency?: string
  priceSource?: PriceSource | null
  /** «Sigue a 99 €. Mirado ahora.» (2.2): se miró y no cambió, así que el trigger no lo pone. */
  priceCheckedAt?: Date | null
  /** «¿Dónde lo compraste?» (2.2b): la tienda de lo pagado, o `null` si fue en otro sitio. */
  priceLinkId?: string | null
  priceStore?: string | null
}

/** Lo que se cambia de una tienda. */
export interface ItemLinkPatch {
  urlTitle?: string | null
  urlSite?: string | null
  priceCents?: number | null
  currency?: string
  priceSource?: PriceSource | null
  priceCheckedAt?: Date | null
}

/**
 * Una vez hecha de una tarea que se repite (3.6, `item_completions`): la tarea no baja a «Fuera de
 * la cabeza», pasa a su siguiente fecha, y esto es la constancia («Hecho hoy», «Hecho ese día»).
 * `item` es la tarea como está ahora (con su fecha nueva); `occurrence`, la fecha que tenía.
 */
export interface Completion {
  id: string
  item: Item
  doneAt: Date
  doneBy: string | null
  occurrence: Date
}
