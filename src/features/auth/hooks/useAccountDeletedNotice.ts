import { useEffect, useState } from 'react'

import { ACCOUNT_DELETED_MESSAGE, forgetAccountDeleted, wasAccountDeleted } from '../accountDeleted'

/** El aviso de cuenta borrada, si toca: se lee al llegar al acceso y se olvida (sale una vez). */
export function useAccountDeletedNotice(): string | null {
  const [deleted] = useState(wasAccountDeleted)
  useEffect(() => {
    if (deleted) forgetAccountDeleted()
  }, [deleted])
  return deleted ? ACCOUNT_DELETED_MESSAGE : null
}
