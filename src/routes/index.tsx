import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <section className="space-y-2 pt-8">
      <h1 className="text-4xl">OnMyMind</h1>
      <p className="text-lg text-muted-foreground">¿Qué tienes en mente?</p>
    </section>
  )
}
