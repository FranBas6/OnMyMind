import { Fingerprint, KeyRound, ScanFace, type LucideProps } from 'lucide-react'

import type { DeviceUnlock } from '../passkey'

/** El icono del desbloqueo de este aparato: la cara de Face ID o la huella (diseño 26, C1b). */
export function DeviceIcon({ unlock, ...props }: { unlock: DeviceUnlock } & LucideProps) {
  if (unlock.title === 'Face ID' || unlock.title === 'Windows Hello') {
    return <ScanFace aria-hidden {...props} />
  }
  if (unlock.title === 'Touch ID' || unlock.title === 'Huella') {
    return <Fingerprint aria-hidden {...props} />
  }
  return <KeyRound aria-hidden {...props} />
}
