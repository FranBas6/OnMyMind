import { useState, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { ListIcon } from '@/components/ListIcon'
import { withPeople } from '@/features/sharing/copy'
import { PeopleButton } from '@/features/sharing/components/SharedInitials'
import { useListSharing } from '@/features/sharing/hooks/useSharing'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import type { List } from '../types'
import { useListActions } from './listActionsContext'
import { ListCardMenu } from './ListCardMenu'

interface ListDetailHeaderProps {
  list: List
  /** «4 pendientes · 2 hechas», calculado con los ítems ya cargados. */
  summary: string
  /** «Nueva sublista» en el menú (diseño 12, S7). */
  onNewSublist?: () => void
  /** El total de las compras pendientes, a la derecha del título (diseño 16, A1). */
  total?: ReactNode
}

/**
 * Cabecera del detalle de una lista (pantalla 4, D1 y diseño 05). «‹ Listas» arriba siempre: el
 * diseño lo quita en escritorio, pero Fran lo quiere también ahí para volver rápido a Inicio. En
 * móvil el menú ··· va en esa fila y el icono es de 52 px; en escritorio el icono es de 56 px y el
 * menú va a la derecha del título. El menú es el de las tarjetas de Inicio. Con compras con precio,
 * el total va a la derecha del título (diseño 16), en escritorio delante del menú. Compartida, las
 * iniciales de quienes están junto al ··· (abren «Quién está») y «con Marta» tras el resumen
 * (diseño 20, M2 y D3).
 */
export function ListDetailHeader({ list, summary, onNewSublist, total }: ListDetailHeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [menuOpen, setMenuOpen] = useState(false)
  const actions = useListActions()
  const { others } = useListSharing(list.id)
  const menu = (
    <div className="flex items-center gap-1.5">
      <PeopleButton
        list={list}
        isDesktop={isDesktop}
        onOpen={() => {
          actions.openPeople(list)
        }}
      />
      <ListCardMenu
        list={list}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="header"
        onNewSublist={onNewSublist}
      />
    </div>
  )

  return (
    <PageHeader
      title={list.name}
      subtitle={others.length > 0 ? `${summary} · ${withPeople(others)}` : summary}
      leading={<ListIcon name={list.name} color={list.color} size={isDesktop ? 'lg' : 'md'} />}
      back={{ to: '/', label: 'Listas' }}
      {...(isDesktop
        ? {
            trailing: (
              <div className="flex items-center gap-4">
                {total}
                {menu}
              </div>
            ),
          }
        : { menu, trailing: total })}
    />
  )
}
