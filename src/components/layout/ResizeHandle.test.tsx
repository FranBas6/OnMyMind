import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { ResizeHandle } from './ResizeHandle'

function Panel({ edge }: { edge: 'start' | 'end' }) {
  const [width, setWidth] = useState(420)
  return (
    <ResizeHandle
      label="Ancho del panel"
      edge={edge}
      value={width}
      min={360}
      max={720}
      onChange={(next) => {
        setWidth(Math.min(720, Math.max(360, next)))
      }}
      onReset={() => {
        setWidth(420)
      }}
    />
  )
}

const handle = () => screen.getByRole('separator', { name: 'Ancho del panel' })

describe('el borde que se arrastra (ResizeHandle)', () => {
  it('con el teclado: ← → (⇧, más), Inicio y Fin; doble clic, el de siempre', async () => {
    const user = userEvent.setup()
    render(<Panel edge="start" />)
    handle().focus()
    // El panel está a la derecha: a la izquierda crece.
    await user.keyboard('{ArrowLeft}')
    expect(handle()).toHaveAttribute('aria-valuenow', '436')
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(handle()).toHaveAttribute('aria-valuenow', '372')
    await user.keyboard('{End}')
    expect(handle()).toHaveAttribute('aria-valuenow', '720')
    await user.keyboard('{Home}')
    expect(handle()).toHaveAttribute('aria-valuenow', '360')
    await user.dblClick(handle())
    expect(handle()).toHaveAttribute('aria-valuenow', '420')
  })

  it('arrastrando: la barra lateral crece hacia la derecha', () => {
    render(<Panel edge="end" />)
    fireEvent.pointerDown(handle(), { button: 0, clientX: 420, pointerId: 1 })
    fireEvent.pointerMove(handle(), { clientX: 470, pointerId: 1 })
    expect(handle()).toHaveAttribute('aria-valuenow', '470')
    fireEvent.pointerUp(handle(), { clientX: 470, pointerId: 1 })
    fireEvent.pointerMove(handle(), { clientX: 600, pointerId: 1 })
    expect(handle()).toHaveAttribute('aria-valuenow', '470')
  })
})
