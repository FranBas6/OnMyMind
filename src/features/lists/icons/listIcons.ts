import {
  Activity,
  Apple,
  Baby,
  Banknote,
  Bed,
  Bike,
  Book,
  Briefcase,
  Cake,
  Calendar,
  Camera,
  Car,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  House,
  Key,
  Lamp,
  Laptop,
  Leaf,
  Luggage,
  MapPin,
  Music,
  Palette,
  PartyPopper,
  PawPrint,
  Pencil,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sofa,
  Tent,
  Ticket,
  Users,
  Utensils,
  Wallet,
  Wine,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * El cuadrado de una lista (5.9, diseño 28): la inicial del nombre, un icono de lucide o un emoji.
 * En la base, `lists.icon` es `lucide:<nombre>`, `emoji:<emoji>` o `null` (la inicial).
 */

export interface ListIconChoice {
  /** El nombre de lucide (`house`), lo que se guarda. */
  name: string
  icon: LucideIcon
  /** Para lectores de pantalla: «Casa». */
  label: string
}

export interface ListIconGroup {
  label: string
  icons: readonly ListIconChoice[]
}

const choice = (name: string, icon: LucideIcon, label: string): ListIconChoice => ({
  name,
  icon,
  label,
})

/**
 * Los iconos del selector: 8 grupos de 6, una fila por grupo (diseño 28, I2). Los cinco primeros
 * son los del diseño; ocio, personas y regalos y dinero los dejó sin dibujar y siguen su criterio.
 */
export const LIST_ICON_GROUPS: readonly ListIconGroup[] = [
  {
    label: 'Casa y hogar',
    icons: [
      choice('house', House, 'Casa'),
      choice('sofa', Sofa, 'Sofá'),
      choice('bed', Bed, 'Cama'),
      choice('lamp', Lamp, 'Lámpara'),
      choice('key', Key, 'Llave'),
      choice('wrench', Wrench, 'Herramientas'),
    ],
  },
  {
    label: 'Compras y comida',
    icons: [
      choice('shopping-cart', ShoppingCart, 'Carrito'),
      choice('shopping-bag', ShoppingBag, 'Bolsa'),
      choice('apple', Apple, 'Manzana'),
      choice('coffee', Coffee, 'Café'),
      choice('utensils', Utensils, 'Cubiertos'),
      choice('wine', Wine, 'Vino'),
    ],
  },
  {
    label: 'Viajes',
    icons: [
      choice('plane', Plane, 'Avión'),
      choice('luggage', Luggage, 'Maleta'),
      choice('map-pin', MapPin, 'Lugar'),
      choice('car', Car, 'Coche'),
      choice('tent', Tent, 'Tienda de campaña'),
      choice('globe', Globe, 'Mundo'),
    ],
  },
  {
    label: 'Trabajo y estudio',
    icons: [
      choice('briefcase', Briefcase, 'Maletín'),
      choice('laptop', Laptop, 'Portátil'),
      choice('book', Book, 'Libro'),
      choice('graduation-cap', GraduationCap, 'Estudios'),
      choice('pencil', Pencil, 'Lápiz'),
      choice('calendar', Calendar, 'Calendario'),
    ],
  },
  {
    label: 'Salud y deporte',
    icons: [
      choice('heart', Heart, 'Corazón'),
      choice('dumbbell', Dumbbell, 'Pesas'),
      choice('bike', Bike, 'Bici'),
      choice('pill', Pill, 'Pastilla'),
      choice('activity', Activity, 'Actividad'),
      choice('leaf', Leaf, 'Hoja'),
    ],
  },
  {
    label: 'Ocio',
    icons: [
      choice('music', Music, 'Música'),
      choice('clapperboard', Clapperboard, 'Cine'),
      choice('gamepad-2', Gamepad2, 'Videojuegos'),
      choice('camera', Camera, 'Cámara'),
      choice('palette', Palette, 'Pintura'),
      choice('ticket', Ticket, 'Entradas'),
    ],
  },
  {
    label: 'Personas y regalos',
    icons: [
      choice('gift', Gift, 'Regalo'),
      choice('cake', Cake, 'Tarta'),
      choice('baby', Baby, 'Bebé'),
      choice('users', Users, 'Personas'),
      choice('paw-print', PawPrint, 'Mascota'),
      choice('party-popper', PartyPopper, 'Fiesta'),
    ],
  },
  {
    label: 'Dinero',
    icons: [
      choice('wallet', Wallet, 'Cartera'),
      choice('piggy-bank', PiggyBank, 'Hucha'),
      choice('credit-card', CreditCard, 'Tarjeta'),
      choice('receipt', Receipt, 'Recibo'),
      choice('coins', Coins, 'Monedas'),
      choice('banknote', Banknote, 'Billete'),
    ],
  },
]

/**
 * Los emojis del selector (diseño 28, I4): 48 en una sola rejilla, sin categorías. Los 42 del
 * diseño, en su orden, y una última fila de dinero, que el diseño no llegó a dibujar.
 */
// prettier-ignore
export const LIST_EMOJIS: readonly string[] = [
  '🏠', '🛋️', '🧹', '🔧', '🪴', '🧺',
  '🛒', '🍎', '🥦', '🍕', '☕', '🍷',
  '✈️', '🧳', '🏖️', '🗺️', '🚗', '🏕️',
  '💼', '💻', '📚', '🎓', '✏️', '📅',
  '❤️', '🏋️', '🚲', '💊', '🧘', '⚽',
  '🎵', '🎬', '🎮', '📷', '🎨', '🎟️',
  '🎁', '🎂', '👶', '🐶', '🎄', '🎉',
  '💶', '🐷', '💳', '🧾', '📈', '⭐',
]

const BY_NAME = new Map(
  LIST_ICON_GROUPS.flatMap((group) => group.icons).map((icon) => [icon.name, icon]),
)

/** Lo que va en el cuadrado: la inicial (`null`), un icono o un emoji. */
export type ListGlyph = { kind: 'icon'; choice: ListIconChoice } | { kind: 'emoji'; emoji: string }

/**
 * Lee `lists.icon`. Lo que no se entiende (un icono que ya no está en el catálogo) se queda en la
 * inicial: así una versión vieja de la app nunca se rompe con uno nuevo.
 */
export function parseListIcon(value: string | null | undefined): ListGlyph | null {
  if (!value) return null
  if (value.startsWith('lucide:')) {
    const found = BY_NAME.get(value.slice('lucide:'.length))
    return found ? { kind: 'icon', choice: found } : null
  }
  if (value.startsWith('emoji:')) {
    const emoji = value.slice('emoji:'.length)
    return emoji ? { kind: 'emoji', emoji } : null
  }
  return null
}

/** Lo que se guarda en `lists.icon`. */
export const iconValue = (name: string) => `lucide:${name}`
export const emojiValue = (emoji: string) => `emoji:${emoji}`
