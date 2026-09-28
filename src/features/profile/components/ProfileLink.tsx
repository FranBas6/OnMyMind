import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useProfile } from '../hooks/useProfile'
import { ProfileAvatar } from './ProfileAvatar'

/**
 * Pie del sidebar (diseño 09, D1): tu avatar y tu nombre, que abren Perfil. Se marca en índigo
 * estando en él. Es, con el avatar de Inicio, la entrada a Perfil en escritorio.
 */
export function ProfileLink() {
  const profile = useProfile()
  const active = useRouterState({ select: (state) => state.location.pathname === '/profile' })
  const name = profile.data?.displayName ?? ''

  return (
    <Link
      to="/profile"
      aria-label="Perfil"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-12 shrink-0 items-center gap-2.5 rounded-[14px] border bg-card px-2.5 text-sm font-semibold outline-none hover:border-control focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'border-primary text-primary' : 'border-border',
      )}
    >
      <ProfileAvatar name={name} size="sm" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <ChevronRight aria-hidden className="size-4 text-subtle-foreground" />
    </Link>
  )
}
