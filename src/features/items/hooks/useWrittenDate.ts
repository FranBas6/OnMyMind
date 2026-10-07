import { useState } from 'react'

import { parseNaturalDate, type NaturalDate } from '@/lib/naturalDate'

import type { ItemKind } from '../status'
import { writtenDateFields, type WrittenDate } from '../writtenDate'

export interface WrittenDateState {
  /** Lo entendido (con la fecha y el aviso que se guardarían), aunque esté deshecho. */
  understood: { parsed: NaturalDate; written: WrittenDate } | null
  /** Se tocó la pastilla: se guarda el texto tal cual (diseño 21, A5). */
  undone: boolean
  /** Tocar la pastilla: deshace o lo vuelve a entender. */
  toggle: () => void
  /** El título y la fecha que se guardan ahora. */
  toSave: { title: string; written: WrittenDate | null }
  /** Al guardar, la pastilla vuelve a empezar. */
  reset: () => void
}

/**
 * Las fechas escritas de un campo (3.5, diseño 21): lo que se entiende de `text` si lo que se va a
 * guardar es una tarea o un evento (`kind`; `null` en compras, «En mente» o sublistas). Mientras se
 * escribe se vuelve a entender; deshecho, se queda deshecho hasta que el texto ya no dice ninguna
 * fecha o se guarda.
 */
export function useWrittenDate(text: string, kind: ItemKind | null): WrittenDateState {
  const [undone, setUndone] = useState(false)
  const parsed = kind ? parseNaturalDate(text) : null
  const written = parsed && kind ? writtenDateFields(parsed, kind) : null
  const understood = parsed && written ? { parsed, written } : null
  // Sin nada entendido, la próxima fecha que se escriba sale ya entendida.
  if (!understood && undone) setUndone(false)
  const active = understood && !undone ? understood : null
  return {
    understood,
    undone,
    toggle: () => {
      setUndone((current) => !current)
    },
    toSave: {
      title: active ? active.parsed.title : text.trim(),
      written: active ? active.written : null,
    },
    reset: () => {
      setUndone(false)
    },
  }
}
