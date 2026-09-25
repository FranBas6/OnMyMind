import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { formatHeaderDate } from '@/lib/date'

export const Route = createFileRoute('/_authenticated/today')({
  component: TodayPage,
})

/** Hoy (diseño, pantalla 7). El contenido llega en 1.11. */
function TodayPage() {
  return <PageHeader eyebrow={formatHeaderDate(new Date())} title="Hoy" />
}
