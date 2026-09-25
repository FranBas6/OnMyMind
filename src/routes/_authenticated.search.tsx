import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/search')({
  component: SearchPage,
})

function SearchPage() {
  return <h1 className="text-2xl">Buscar</h1>
}
