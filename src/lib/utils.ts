import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases condicionales y resuelve conflictos de Tailwind (p. ej. `px-2` + `px-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
