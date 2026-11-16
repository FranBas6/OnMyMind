import { describe, expect, it } from 'vitest'

import { emojiValue, iconValue, LIST_EMOJIS, LIST_ICON_GROUPS, parseListIcon } from './listIcons'

describe('los iconos de las listas (5.9, diseño 28)', () => {
  it('8 grupos de 6 iconos y 48 emojis, sin repetir', () => {
    expect(LIST_ICON_GROUPS).toHaveLength(8)
    for (const group of LIST_ICON_GROUPS) expect(group.icons).toHaveLength(6)
    const names = LIST_ICON_GROUPS.flatMap((group) => group.icons.map((icon) => icon.name))
    expect(new Set(names).size).toBe(48)
    expect(LIST_EMOJIS).toHaveLength(48)
    expect(new Set(LIST_EMOJIS).size).toBe(48)
  })

  it('lo que se guarda cumple el formato de la base (`lists_icon_check`)', () => {
    const format = /^(lucide:[a-z0-9]+(-[a-z0-9]+)*|emoji:\S{1,16})$/u
    for (const group of LIST_ICON_GROUPS) {
      for (const icon of group.icons) expect(iconValue(icon.name)).toMatch(format)
    }
    for (const emoji of LIST_EMOJIS) expect(emojiValue(emoji)).toMatch(format)
  })

  it('se lee lo guardado; lo que no se entiende es la inicial', () => {
    expect(parseListIcon('lucide:house')).toMatchObject({
      kind: 'icon',
      choice: { name: 'house', label: 'Casa' },
    })
    expect(parseListIcon('emoji:✈️')).toEqual({ kind: 'emoji', emoji: '✈️' })
    expect(parseListIcon(null)).toBeNull()
    expect(parseListIcon('lucide:no-existe')).toBeNull()
    expect(parseListIcon('emoji:')).toBeNull()
    expect(parseListIcon('casa')).toBeNull()
  })
})
