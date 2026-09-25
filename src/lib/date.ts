import { format, setDefaultOptions } from 'date-fns'
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
