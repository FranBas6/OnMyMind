import { List, Search, Sun, User, type LucideIcon } from 'lucide-react'

export interface NavDestination {
  to: '/' | '/today' | '/search' | '/profile'
  label: string
  icon: LucideIcon
}

/** Los cuatro destinos de la barra inferior (diseño, pantallas 2 a 14). */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { to: '/', label: 'Listas', icon: List },
  { to: '/today', label: 'Hoy', icon: Sun },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/profile', label: 'Perfil', icon: User },
]

/** «Listas» cubre Inicio y el detalle de cualquier lista; el resto, su ruta y lo que cuelgue. */
export function isDestinationActive(to: NavDestination['to'], pathname: string): boolean {
  if (to === '/') return pathname === '/' || pathname.startsWith('/lists/')
  return pathname === to || pathname.startsWith(`${to}/`)
}
