import { describe, expect, it } from 'vitest'

import {
  fromBase64,
  generateVaultKey,
  keyCheck,
  matchesCheck,
  openText,
  randomBytes,
  sealText,
  toBase64,
  unwrapWithPassword,
  unwrapWithPrf,
  wrapWithPassword,
  wrapWithPrf,
} from './vault'

// Pocas vueltas: los tests miran el cifrado, no lo que tarda.
const ITERATIONS = 1000

describe('la clave privada (vault.ts)', () => {
  it('base64 de ida y vuelta', () => {
    const bytes = randomBytes(48)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('con la clave privada se descifra la clave de la caja; con otra, no', async () => {
    const key = await generateVaultKey()
    const check = await keyCheck(key)
    const wrap = await wrapWithPassword(key, 'la del candado azul', ITERATIONS)

    expect(wrap.iterations).toBe(ITERATIONS)
    expect(fromBase64(wrap.salt)).toHaveLength(16)
    expect(fromBase64(wrap.iv)).toHaveLength(12)
    // La clave de la caja (32 bytes) y la etiqueta de AES-GCM (16).
    expect(fromBase64(wrap.wrapped)).toHaveLength(48)

    const opened = await unwrapWithPassword(wrap, 'la del candado azul')
    if (!opened) throw new Error('no se ha abierto')
    expect(await matchesCheck(opened, check)).toBe(true)
    expect(await unwrapWithPassword(wrap, 'la del candado rojo')).toBeNull()
  })

  it('una tilde escrita de otra forma es la misma clave', async () => {
    const key = await generateVaultKey()
    const wrap = await wrapWithPassword(key, 'canción', ITERATIONS)
    // «o» + tilde combinada, como la escriben algunos teclados.
    expect(await unwrapWithPassword(wrap, 'canción')).not.toBeNull()
    // Los espacios sí cuentan.
    expect(await unwrapWithPassword(wrap, 'canción ')).toBeNull()
  })

  it('cambiar la clave privada vuelve a cifrar la misma clave de la caja', async () => {
    const key = await generateVaultKey()
    const check = await keyCheck(key)
    const before = await wrapWithPassword(key, 'primera clave', ITERATIONS)
    const opened = await unwrapWithPassword(before, 'primera clave')
    if (!opened) throw new Error('no se ha abierto')

    const after = await wrapWithPassword(opened, 'segunda clave', ITERATIONS)
    expect(after.salt).not.toBe(before.salt)
    const reopened = await unwrapWithPassword(after, 'segunda clave')
    if (!reopened) throw new Error('no se ha abierto')
    expect(await matchesCheck(reopened, check)).toBe(true)
    expect(await unwrapWithPassword(after, 'primera clave')).toBeNull()
  })

  it('con lo que da una llave de acceso (PRF) se descifra la misma clave', async () => {
    const key = await generateVaultKey()
    const check = await keyCheck(key)
    const output = randomBytes(32)
    const wrap = await wrapWithPrf(key, output)

    const opened = await unwrapWithPrf(wrap, output)
    if (!opened) throw new Error('no se ha abierto')
    expect(await matchesCheck(opened, check)).toBe(true)
    expect(await unwrapWithPrf(wrap, randomBytes(32))).toBeNull()
  })

  it('el comprobador distingue una clave de la caja de otra', async () => {
    const check = await keyCheck(await generateVaultKey())
    expect(fromBase64(check)).toHaveLength(32)
    expect(await matchesCheck(await generateVaultKey(), check)).toBe(false)
  })

  it('el texto de una nota protegida: se abre con su clave, no con otra ni cambiado', async () => {
    const key = await generateVaultKey()
    const text = 'Red: MiFibra-7A2F\nClave: tq8M-29xk-Lp4r · ñ'
    const sealed = await sealText(key, text)

    expect(fromBase64(sealed.iv)).toHaveLength(12)
    expect(sealed.sealed).not.toContain('tq8M')
    expect(await openText(key, sealed)).toBe(text)
    // Lo mismo otra vez no da lo mismo: otro vector.
    expect((await sealText(key, text)).sealed).not.toBe(sealed.sealed)

    expect(await openText(await generateVaultKey(), sealed)).toBeNull()
    const bytes = fromBase64(sealed.sealed)
    bytes[0] = (bytes[0] ?? 0) ^ 1
    expect(await openText(key, { ...sealed, sealed: toBase64(bytes) })).toBeNull()
    // Vacío también se cifra: la etiqueta de AES-GCM, 16 bytes, que en base64 son 24 (el mínimo
    // de la base).
    expect((await sealText(key, '')).sealed).toHaveLength(24)
  })
})
