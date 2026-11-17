import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ids que se quedan «un momento» donde estaban. Al completar un ítem, su fila sigue en su sitio
 * `ms` milisegundos para que se vea el check antes de bajar a «Fuera de la cabeza» (06
 * §Interacción). Cada `hold` reinicia su propio temporizador; al desmontar se cancelan todos.
 */
export function useLingering(ms: number) {
  const [lingering, setLingering] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => {
        window.clearTimeout(timer)
      })
    }
  }, [])

  const hold = useCallback(
    (id: string) => {
      setLingering((current) => new Set(current).add(id))
      window.clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        window.setTimeout(() => {
          timers.current.delete(id)
          setLingering((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
          })
        }, ms),
      )
    },
    [ms],
  )

  return { lingering, hold }
}
