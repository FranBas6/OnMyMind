import { useState } from 'react'

import { pastedLines, pastedRows, type PastedRow } from '../pastedLines'

export interface PastedLinesState {
  /** Lo pegado: el texto tal cual (para «Como una sola») y sus líneas. `null` sin nada pegado. */
  pasted: { text: string; rows: PastedRow[]; overflow: number } | null
  /** Las que se van a añadir (sin las quitadas). */
  count: number
  /** Al pegar en el campo vacío: si es una lista, la ofrece y devuelve `true` (no se pega). */
  offer: (text: string) => boolean
  toggleRemoved: (index: number) => void
  toggleDate: (index: number) => void
  /** «Como una sola», guardar o cerrar: se olvida lo pegado. */
  clear: () => void
}

/** Pegar varias líneas (4.3, diseño 23, B) en la captura o en la barra de añadir. */
export function usePastedLines(): PastedLinesState {
  const [pasted, setPasted] = useState<PastedLinesState['pasted']>(null)
  const toggle = (index: number, key: 'removed' | 'dateUndone') => {
    setPasted(
      (current) =>
        current && {
          ...current,
          rows: current.rows.map((row, at) => (at === index ? { ...row, [key]: !row[key] } : row)),
        },
    )
  }
  return {
    pasted,
    count: pasted?.rows.filter((row) => !row.removed).length ?? 0,
    offer: (text) => {
      const list = pastedLines(text)
      if (!list) return false
      setPasted({ text, rows: pastedRows(list), overflow: list.overflow })
      return true
    },
    toggleRemoved: (index) => {
      toggle(index, 'removed')
    },
    toggleDate: (index) => {
      toggle(index, 'dateUndone')
    },
    clear: () => {
      setPasted(null)
    },
  }
}
