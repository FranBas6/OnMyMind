import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/lists/')({
  component: ListsPage,
})

function ListsPage() {
  return <h1 className="text-2xl">Listas</h1>
}
