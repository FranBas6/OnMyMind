import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/queryKeys'

import { isPersistable } from './persister'

describe('lo que se guarda con la caché (5.6, ADR-013)', () => {
  it('se guarda lo terminado con éxito, nunca lo desbloqueado ni lo que falló', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await queryClient.query({ queryKey: ['listas'], queryFn: () => ['Casa'] })
    await queryClient.query({
      queryKey: ['nota'],
      queryFn: () => 'Red: MiFibra-7A2F',
      meta: { private: true },
    })
    await queryClient
      .query({ queryKey: ['roto'], queryFn: () => Promise.reject(new Error('sin red')) })
      .catch(() => undefined)

    const query = (key: string) => {
      const found = queryClient.getQueryCache().find({ queryKey: [key] })
      if (!found) throw new Error(`falta ${key}`)
      return found
    }
    expect(isPersistable(query('listas'))).toBe(true)
    expect(isPersistable(query('nota'))).toBe(false)
    expect(isPersistable(query('roto'))).toBe(false)
  })

  it('el texto de una nota protegida no se guarda, tampoco dejado a mano (5.7)', () => {
    const queryClient = new QueryClient()
    const key = queryKeys.openedNote('wifi', 'aXYtZGUtMTItYnl0')
    queryClient.setQueryData(key, 'Clave: tq8M-29xk-Lp4r')
    const found = queryClient.getQueryCache().find({ queryKey: key })
    if (!found) throw new Error('falta la nota')
    expect(isPersistable(found)).toBe(false)
  })
})
