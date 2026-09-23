import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '@/test/render-route'

describe('Página de inicio', () => {
  it('muestra el título y la pregunta de captura', async () => {
    renderRoute('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'OnMyMind' })).toBeInTheDocument()
    expect(screen.getByText('¿Qué tienes en mente?')).toBeInTheDocument()
  })
})
