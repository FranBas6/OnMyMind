import { Calendar, CircleCheck, ShoppingBag, type LucideIcon } from 'lucide-react'

import { SublistGlyph } from '@/components/SublistGlyph'

import type { AddableKind } from '../kind'

/** El icono de cada tipo en sus selectores y en la fila «Tipo» del detalle (diseño 12). */
export const KIND_ICONS: Record<AddableKind, LucideIcon> = {
  task: CircleCheck,
  shopping: ShoppingBag,
  event: Calendar,
  sublist: SublistGlyph,
}
