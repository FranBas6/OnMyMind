import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/today')({
  component: TodayPage,
})

function TodayPage() {
  return <h1 className="text-2xl">Hoy</h1>
}
