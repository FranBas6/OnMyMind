import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

/**
 * Estructura mínima de la app. Respeta las safe areas de iOS (viewport-fit=cover).
 * Aquí se añadirán BottomNav (móvil) y Sidebar (escritorio).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-2xl flex-1 pt-[max(env(safe-area-inset-top),1.5rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] pl-[max(env(safe-area-inset-left),1rem)]">
        {children}
      </main>
    </div>
  )
}
