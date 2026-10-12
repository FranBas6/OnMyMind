import { useState } from 'react'

import { pastedLines, pastedRows, type PastedRow } from '../pastedLines'

export interface PastedLinesState {
  /**
   * Lo pegado: el texto tal cual y sus líneas. `single`: se añade todo en una sola cosa, una nota
   * con todo (diseño 25, B4); si no, una por línea (diseño 23). `null` sin nada pegado.
   */
  pasted: { text: string; rows: PastedRow[]; overflow: number; single: boolean } | null
  /** Las que se van a añadir (sin las quitadas). */
  count: number
  /**
   * Al pegar en el campo vacío: si es una lista, la ofrece y devuelve `true` (no se pega). `asNote`:
   * lo que se crea es una nota, así que se ofrece entero en una (bastan dos líneas).
   */
  offer: (text: string, asNote?: boolean) => boolean
  /** «Una cosa por línea» (`false`) o, si se crea una nota, «Como una sola» (`true`). */
  setSingle: (single: boolean) => void
  toggleRemoved: (index: number) => void
  toggleDate: (index: number) => void
  /** «Como una sola», guardar o cerrar: se olvida lo pegado. */
  clear: () => void
}

/** Pegar varias líneas (4.3, diseño 23, B; 5.4, diseño 25, B4) en la captura o en la barra. */
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
    offer: (text, asNote = false) => {
      const list = pastedLines(text, { twoLines: asNote })
      if (!list) return false
      setPasted({ text, rows: pastedRows(list), overflow: list.overflow, single: asNote })
      return true
    },
    setSingle: (single) => {
      setPasted((current) => current && { ...current, single })
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
