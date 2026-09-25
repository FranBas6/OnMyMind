import { describe, expect, it } from 'vitest'

import { signInSchema, signUpSchema } from './schemas'

describe('esquemas de acceso', () => {
  it('limpia espacios del email', () => {
    const result = signInSchema.parse({ email: '  fran@test.local ', password: 'x' })
    expect(result.email).toBe('fran@test.local')
  })

  it('email mal escrito', () => {
    const result = signInSchema.safeParse({ email: 'fran@', password: 'x' })
    expect(result.error?.issues[0]?.message).toBe('Escribe un email válido.')
  })

  it('entrar solo exige que haya contraseña', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '123' }).success).toBe(true)
    const empty = signInSchema.safeParse({ email: 'a@b.co', password: '' })
    expect(empty.error?.issues[0]?.message).toBe('Escribe tu contraseña.')
  })

  it('crear cuenta exige al menos 8 caracteres', () => {
    const short = signUpSchema.safeParse({ email: 'a@b.co', password: '1234567' })
    expect(short.error?.issues[0]?.message).toBe('La contraseña necesita al menos 8 caracteres.')
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: '12345678' }).success).toBe(true)
  })
})
