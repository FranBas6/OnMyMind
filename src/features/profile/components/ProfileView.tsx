import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { useProfile } from '../hooks/useProfile'
import { AccountSection } from './AccountSection'
import { AppSection } from './AppSection'
import { DefaultListSetting } from './DefaultListSetting'
import { ProfileHeader } from './ProfileHeader'
import { StatsRow } from './StatsRow'
import { ThemeSetting } from './ThemeSetting'

/**
 * Perfil de la fase 1 (02 §Perfil, pantalla 14 y diseños 09 y 10): tu nombre y email, dos cifras,
 * Apariencia, Captura, App (versión e instalar) y Cuenta. En escritorio, a dos columnas y con la
 * nota de que los ajustes viajan con la cuenta. Lo de la fase 2 (avisos, exportar, ahorrados, borrar la
 * cuenta) no sale.
 */
export function ProfileView() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const profile = useProfile()

  return (
    <div className="flex flex-col gap-[22px] md:gap-6">
      <PageHeader title="Perfil" />

      {profile.isError && (
        <p role="alert" className="px-1 text-[15px] text-muted-foreground">
          No hemos podido cargar tu perfil. Prueba otra vez en un momento.
        </p>
      )}
      {profile.data && (
        <ProfileHeader
          name={profile.data.displayName}
          email={profile.email}
          isDesktop={isDesktop}
        />
      )}
      <StatsRow />

      <div className="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:gap-6">
        <Section title="Apariencia">
          <ThemeSetting />
          {isDesktop && (
            <p className="px-1 pt-2 text-[13px] leading-[1.4] text-subtle-foreground">
              Se guarda en tu cuenta: el iPhone y el ordenador van iguales.
            </p>
          )}
        </Section>
        <Section title="Captura">
          <DefaultListSetting isDesktop={isDesktop} />
        </Section>
      </div>

      {/* «App» entre Captura y Cuenta; en escritorio, las dos en la segunda fila (diseño 10, D3). */}
      <div className="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:gap-6">
        <Section title="App">
          <AppSection />
        </Section>
        <Section title="Cuenta">
          <AccountSection isDesktop={isDesktop} />
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={cn('min-w-0', className)}>
      <h2 className="px-1 pb-2 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
