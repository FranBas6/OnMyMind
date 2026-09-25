import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/_authenticated/lists/$listId')({
  component: ListDetailPage,
})

/** Detalle de lista (diseño, pantalla 4). Nombre, icono, contadores y menú llegan en 1.7. */
function ListDetailPage() {
  return <PageHeader back={{ to: '/', label: 'Listas' }} title="Lista" />
}
