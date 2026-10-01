import { useState, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { ListIcon } from '@/components/ListIcon'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import type { List } from '../types'
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
 * el total va a la derecha del título (diseño 16), en escritorio delante del menú.
 */
export function ListDetailHeader({ list, summary, onNewSublist, total }: ListDetailHeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = (
    <ListCardMenu
      list={list}
      open={menuOpen}
      onOpenChange={setMenuOpen}
      variant="header"
      onNewSublist={onNewSublist}
    />
  )

  return (
    <PageHeader
      title={list.name}
      subtitle={summary}
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
