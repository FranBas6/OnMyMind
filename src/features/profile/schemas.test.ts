import { describe, expect, it } from 'vitest'

import { displayNameSchema, isNameFromEmail, mergeSettings, parseSettings } from './schemas'

const INBOX = '11111111-1111-4111-8111-111111111111'

describe('parseSettings', () => {
  it('con todo guardado, lo lee tal cual', () => {
    expect(
      parseSettings({
        theme: 'dark',
        default_list_id: INBOX,
        daily_summary_time: '08:30',
        price_drop_alerts: true,
        timezone: 'Atlantic/Canary',
      }),
    ).toEqual({
      theme: 'dark',
      defaultListId: INBOX,
      dailySummaryTime: '08:30',
      priceDropAlerts: true,
      timezone: 'Atlantic/Canary',
    })
  })

  it('con el JSON incompleto, cada clave que falta toma su valor por defecto', () => {
    expect(parseSettings({ default_list_id: INBOX })).toEqual({
      theme: 'system',
      defaultListId: INBOX,
      dailySummaryTime: null,
      priceDropAlerts: false,
      timezone: 'Europe/Madrid',
    })
  })

  it('con basura en una clave, solo esa vuelve a su valor por defecto', () => {
    const settings = parseSettings({
      theme: 'violeta',
      default_list_id: 'no-es-un-uuid',
      daily_summary_time: '25:99',
      price_drop_alerts: 'sí',
      timezone: '',
    })
    expect(settings).toMatchObject({
      theme: 'system',
      defaultListId: null,
      dailySummaryTime: null,
      priceDropAlerts: false,
      timezone: 'Europe/Madrid',
    })
  })

  it('si `settings` no es un objeto, todo por defecto sin romper', () => {
    for (const raw of [null, undefined, 'hola', 42, ['dark']]) {
      expect(parseSettings(raw).theme).toBe('system')
    }
  })
})

describe('mergeSettings', () => {
  it('cambia solo lo que se toca y conserva claves desconocidas', () => {
    expect(
      mergeSettings({ theme: 'light', timezone: 'Europe/Madrid', futura: 1 }, { theme: 'dark' }),
    ).toEqual({ theme: 'dark', timezone: 'Europe/Madrid', futura: 1 })
    expect(mergeSettings(null, { defaultListId: INBOX })).toEqual({ default_list_id: INBOX })
  })

  it('la zona y el resumen de Hoy (2.6), con sus claves de la base', () => {
    expect(
      mergeSettings({ theme: 'dark' }, { timezone: 'Atlantic/Canary', dailySummaryTime: '08:00' }),
    ).toEqual({ theme: 'dark', timezone: 'Atlantic/Canary', daily_summary_time: '08:00' })
    expect(mergeSettings({ daily_summary_time: '08:00' }, { dailySummaryTime: null })).toEqual({
      daily_summary_time: null,
    })
  })
})

describe('nombre', () => {
  it('sin espacios alrededor, sin vacío y hasta 50', () => {
    expect(displayNameSchema.parse('  Ana Ruiz ')).toBe('Ana Ruiz')
    expect(displayNameSchema.safeParse('   ').error?.issues[0]?.message).toBe('Ponle un nombre.')
    expect(displayNameSchema.safeParse('a'.repeat(51)).success).toBe(false)
    expect(displayNameSchema.safeParse('a'.repeat(50)).success).toBe(true)
  })

  it('reconoce el nombre que salió del email', () => {
    expect(isNameFromEmail('ana', 'ana@ejemplo.com')).toBe(true)
    expect(isNameFromEmail('Ana Ruiz', 'ana@ejemplo.com')).toBe(false)
    expect(isNameFromEmail(null, undefined)).toBe(false)
  })
})
