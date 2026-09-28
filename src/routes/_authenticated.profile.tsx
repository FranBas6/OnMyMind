import { createFileRoute } from '@tanstack/react-router'

import { ProfileView } from '@/features/profile'

export const Route = createFileRoute('/_authenticated/profile')({
  // Perfil es una pantalla de ajustes: sin el + de captura, como en el diseño (14 y 09).
  staticData: { noFab: true },
  component: ProfilePage,
})

/** Perfil (pantalla 14 y diseño 09): compone la vista de `features/profile`. */
function ProfilePage() {
  return <ProfileView />
}
