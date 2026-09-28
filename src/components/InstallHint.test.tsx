import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { PwaContext, type PwaApi, usePwa } from '@/hooks/usePwa'
import { readInstallHint, writeInstallHint } from '@/lib/installHint'

import { InstallHint } from './InstallHint'

/** Un `PwaProvider` de mentira: solo lo de la hoja, con su estado de verdad. */
function Harness({ canInstall = true }: { canInstall?: boolean }) {
  const base = usePwa()
  const [open, setOpen] = useState(false)
  const api: PwaApi = {
    ...base,
    canInstall,
    installOpen: open,
    openInstall: () => {
      setOpen(true)
    },
    closeInstall: (choice) => {
      const record = readInstallHint()
      writeInstallHint({
        shown: record.shown,
        dismissedAt: new Date().toISOString(),
        never: record.never || choice === 'never',
      })
      setOpen(false)
    },
  }
  return (
    <PwaContext value={api}>
      <InstallHint />
    </PwaContext>
  )
}

describe('Instalar en el iPhone', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('sale sola la primera vez, con los tres pasos', async () => {
    render(<Harness />)
    expect(await screen.findByText('Compartir')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Añadir a pantalla de inicio')).toBeInTheDocument()
    expect(readInstallHint().shown).toBe(1)
  })

  it('«No volver a mostrar» la cierra para siempre', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    await user.click(await screen.findByRole('button', { name: 'No volver a mostrar' }))
    expect(readInstallHint().never).toBe(true)
    unmount()

    render(<Harness />)
    expect(screen.queryByText('Instalar en el iPhone')).not.toBeInTheDocument()
  })

  it('«Lo haré después» no vuelve enseguida', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    await user.click(await screen.findByRole('button', { name: 'Lo haré después' }))
    unmount()

    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Lo haré después' })).not.toBeInTheDocument()
  })

  it('fuera de Safari del iPhone, nunca', () => {
    render(<Harness canInstall={false} />)
    expect(screen.queryByText('Instalar en el iPhone')).not.toBeInTheDocument()
    expect(readInstallHint().shown).toBe(0)
  })
})
