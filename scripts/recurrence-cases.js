// Escribe supabase/tests/recurrence_cases.test.sql con los casos de la repetición que también
// prueba TypeScript (src/features/items/recurrence.cases.ts), para que las dos cuentas den lo
// mismo (3.6). `pnpm db:cases`; el test de recurrence.ts avisa si hace falta.
import { writeFileSync } from 'node:fs'

import { renderSqlCases } from '../src/features/items/recurrence.cases.ts'

writeFileSync(
  new URL('../supabase/tests/recurrence_cases.test.sql', import.meta.url),
  renderSqlCases(),
)
console.log('supabase/tests/recurrence_cases.test.sql')
