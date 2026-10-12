import { Calendar, Circle, FileText, Square, type LucideIcon } from 'lucide-react'

import { SublistGlyph } from '@/components/SublistGlyph'

import type { AddableKind } from '../kind'

/**
 * El icono de cada tipo en sus selectores, en la barra de añadir y en la fila «Tipo» del detalle
 * (diseño 25, B5c): la hoja de la nota, y la forma del control de cada uno en su fila (el círculo
 * de la tarea, el cuadrado de la compra y el calendario del evento).
 */
export const KIND_ICONS: Record<AddableKind, LucideIcon> = {
  note: FileText,
  task: Circle,
  shopping: Square,
  event: Calendar,
  sublist: SublistGlyph,
}
