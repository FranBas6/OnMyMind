import { setDefaultOptions } from 'date-fns'
import { es } from 'date-fns/locale'

/** Configura date-fns en español para toda la app (format, formatDistance, startOfWeek…). */
export function configureDateLocale() {
  setDefaultOptions({ locale: es })
}
