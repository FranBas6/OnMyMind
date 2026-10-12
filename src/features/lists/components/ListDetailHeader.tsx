import { useState, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { ListIcon } from '@/components/ListIcon'
import { withPeople } from '@/features/sharing/copy'
import { PeopleButton } from '@/features/sharing/components/SharedInitials'
import { useListSharing } from '@/features/sharing/hooks/useSharing'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import type { List, ListView } from '../types'
import { useListActions } from './listActionsContext'
import { ListCardMenu } from './ListCardMenu'
import { ListViewSwitch } from './ListViewSwitch'

interface ListDetailHeaderProps {
  list: List
  /** «4 pendientes · 2 hechas», calculado con los ítems ya cargados. */
  summary: string
  /** «Nueva sublista» en el menú (diseño 12, S7). */
  onNewSublist?: () => void
  /** El total de las compras pendientes, a la derecha del título (diseño 16, A1). */
  total?: ReactNode
  /** «Lista · Agenda», en una lista con eventos (diseño 25, B10 y D5). */
  view?: { value: ListView; onChange: (view: ListView) => void } | undefined
}

/**
 * Cabecera del detalle de una lista (pantalla 4, D1 y diseño 05). «‹ Listas» arriba siempre: el
 * diseño lo quita en escritorio, pero Fran lo quiere también ahí para volver rápido a Inicio. En
 * móvil el menú ··· va en esa fila y el icono es de 52 px; en escritorio el icono es de 56 px y el
 * menú va a la derecha del título. El menú es el de las tarjetas de Inicio. Con compras con precio,
 * el total va a la derecha del título (diseño 16), en escritorio delante del menú. Compartida, las
 * iniciales de quienes están junto al ··· (abren «Quién está») y «con Marta» tras el resumen
 * (diseño 20, M2 y D3). Con eventos, «Lista · Agenda»: bajo el título en el móvil y a su derecha en
 * escritorio (diseño 25, B10 y D5).
 */
export function ListDetailHeader({
  list,
  summary,
  onNewSublist,
  total,
  view,
}: ListDetailHeaderProps) {
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

  const viewSwitch = view && <ListViewSwitch value={view.value} onChange={view.onChange} />

  const header = (
    <PageHeader
      title={list.name}
      subtitle={others.length > 0 ? `${summary} · ${withPeople(others)}` : summary}
      leading={<ListIcon name={list.name} color={list.color} size={isDesktop ? 'lg' : 'md'} />}
      back={{ to: '/', label: 'Listas' }}
      {...(isDesktop
        ? {
            trailing: (
              <div className="flex items-center gap-4">
                {viewSwitch}
                {total}
                {menu}
              </div>
            ),
          }
        : { menu, trailing: total })}
    />
  )
  if (isDesktop || !viewSwitch) return header
  return (
    <div className="flex flex-col gap-3.5">
      {header}
      {viewSwitch}
    </div>
  )
}
