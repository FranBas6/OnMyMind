import {
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isSameDay,
  isSameYear,
  setDefaultOptions,
} from 'date-fns'
import { es } from 'date-fns/locale'

/** Configura date-fns en español para toda la app (format, formatDistance, startOfWeek…). */
export function configureDateLocale() {
  setDefaultOptions({ locale: es })
}

/** Fecha de cabecera de Inicio y Hoy: «Lunes, 22 de septiembre». */
export function formatHeaderDate(date: Date): string {
  const text = format(date, "EEEE, d 'de' MMMM")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Antigüedad corta de una captura (Inicio en escritorio, diseño 03 Inicio): «ahora»,
 * «hace 5 min», «hace 2 h» (mismo día), «ayer», el día de la semana hasta seis días atrás
 * («martes») y, después, la fecha («3 sep», con año si no es el actual).
 */
export function formatCaptureAge(date: Date, now: Date = new Date()): string {
  const minutes = differenceInMinutes(now, date)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  if (isSameDay(date, now)) return `hace ${Math.floor(minutes / 60)} h`
  const days = differenceInCalendarDays(now, date)
  if (days === 1) return 'ayer'
  if (days < 7) return format(date, 'EEEE')
  return format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy')
}

export interface DueDateLabel {
  text: string
  /** Hoy o antes: el chip va en rojo (diseño, pantalla 4). */
  urgent: boolean
}

/**
 * Fecha límite de una tarea en su chip: «Hoy», «Mañana», «Ayer» y, si no, la fecha («3 oct», con
 * año si no es el actual). Se compara por día natural en la zona del dispositivo: una fecha sin
 * hora se guarda como las 00:00 locales (04 §Fechas).
 */
export function formatDueDate(date: Date, now: Date = new Date()): DueDateLabel {
  const days = differenceInCalendarDays(date, now)
  const urgent = days <= 0
  if (days === 0) return { text: 'Hoy', urgent }
  if (days === 1) return { text: 'Mañana', urgent }
  if (days === -1) return { text: 'Ayer', urgent }
  return { text: format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy'), urgent }
}
