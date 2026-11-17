import { useState } from 'react'

/**
 * Si lo de esta pantalla se ha visto desbloqueado alguna vez: entonces, al bloquearse, «Se han
 * bloqueado» (diseño 27, D3d), y si no, «Bloqueadas».
 */
export function useSeenUnlocked(unlocked: boolean): boolean {
  const [seen, setSeen] = useState(unlocked)
  if (unlocked && !seen) setSeen(true)
  return seen || unlocked
}
