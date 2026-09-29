import { useEffect, useState } from 'react'

/** La hora actual, que se renueva cada `intervalMs` (cuentas atrás en pantalla). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearInterval(id)
    }
  }, [intervalMs])

  return now
}
