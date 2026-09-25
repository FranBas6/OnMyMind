import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/lists/$listId')({
  component: ListDetailPage,
})

function ListDetailPage() {
  return <h1 className="text-2xl">Lista</h1>
}
