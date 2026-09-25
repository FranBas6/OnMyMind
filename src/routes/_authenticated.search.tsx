import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/_authenticated/search')({
  component: SearchPage,
})

/** Buscar (diseño, pantalla 13). El buscador llega en 1.12. */
function SearchPage() {
  return <PageHeader title="Buscar" />
}
