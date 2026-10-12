import { useState, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PrivateSection } from '@/features/private'
import { cn } from '@/lib/utils'

import { useProfile } from '../hooks/useProfile'
import { AccountSection } from './AccountSection'
import { AppSection } from './AppSection'
import { CalendarSection } from './CalendarSection'
import { DataSection } from './DataSection'
import { DefaultListSetting } from './DefaultListSetting'
import { ExportDialog } from './ExportDialog'
import { NotificationsSection } from './NotificationsSection'
import { ProfileHeader } from './ProfileHeader'
import { StatsRow } from './StatsRow'
import { ThemeSetting } from './ThemeSetting'

/**
 * Perfil (02 §Perfil, pantalla 14 y diseños 09, 10 y 18): tu nombre y email, las cifras,
 * Apariencia, Captura, Privado (la clave privada, 5.6, diseño 26), Avisos (2.6), Calendario (3.7),
 * App (versión e instalar), Datos (exportar, 2.8) y Cuenta (borrarla, 2.8). En escritorio, a dos columnas y con la nota de que los ajustes
 * viajan con la cuenta.
 */
export function ProfileView() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const profile = useProfile()
  const [exporting, setExporting] = useState(false)

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

      {/* Avisos (con Calendario), App, Datos y Cuenta, en el orden del diseño 18 (P1, P6). En escritorio siguen a dos
          columnas (decisión de la 1.13): Avisos y App arriba, Datos y Cuenta abajo. */}
      <div className="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:items-start md:gap-6">
        {/* Calendario (3.7, diseño 21, C1 y D6) va bajo Avisos, en su misma columna; Privado (5.6,
            diseño 26), encima: entre Captura y Avisos. */}
        <div className="flex flex-col gap-[22px] md:gap-6">
          <Section title="Privado">
            <PrivateSection />
          </Section>
          <Section title="Avisos">
            <NotificationsSection isDesktop={isDesktop} />
          </Section>
          <Section title="Calendario">
            <CalendarSection isDesktop={isDesktop} />
          </Section>
        </div>
        <Section title="App">
          <AppSection />
        </Section>
        <Section title="Datos">
          <DataSection
            onExport={() => {
              setExporting(true)
            }}
          />
        </Section>
        <Section title="Cuenta">
          <AccountSection
            isDesktop={isDesktop}
            onExport={() => {
              setExporting(true)
            }}
          />
        </Section>
      </div>
      <ExportDialog open={exporting} onOpenChange={setExporting} isDesktop={isDesktop} />
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
