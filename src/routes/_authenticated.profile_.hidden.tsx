import { createFileRoute } from '@tanstack/react-router'

import { HiddenListsScreen } from '@/features/lists'

export const Route = createFileRoute('/_authenticated/profile_/hidden')({
  // Como Perfil, sin el + de captura (diseño 27, D4).
  staticData: { noFab: true },
  component: HiddenListsScreen,
})
