import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { useUpdateDisplayName } from '../hooks/useProfileMutations'
import { isNameFromEmail } from '../schemas'
import { InlineNameEditor, NameSheet } from './NameEditor'
import { ProfileAvatar } from './ProfileAvatar'

interface ProfileHeaderProps {
  name: string | null
  email: string | undefined
  isDesktop: boolean
}

/**
 * Cabecera de Perfil (diseño 09, P1 y D1): avatar con la inicial, el nombre y el email. Mientras
 * el nombre sea el del alta (lo de antes de la @), lo dice: «nombre tomado del email». El nombre
 * se cambia tocándolo o con el lápiz (en escritorio, «Cambiar»): una hoja en móvil, el campo en
 * el sitio en escritorio.
 */
export function ProfileHeader({ name, email, isDesktop }: ProfileHeaderProps) {
  const [editing, setEditing] = useState(false)
  const updateName = useUpdateDisplayName()
  const fromEmail = isNameFromEmail(name, email)
  const shown = name ?? ''

  const save = (next: string) => {
    updateName.mutate(next)
  }
  const edit = () => {
    setEditing(true)
  }

  return (
    <div className="flex items-center gap-3.5 px-1 md:gap-[18px] md:px-0">
      <ProfileAvatar name={name} size={isDesktop ? 'lg' : 'md'} />
      {isDesktop && editing ? (
        <InlineNameEditor
          name={shown}
          onSave={save}
          onClose={() => {
            setEditing(false)
          }}
        />
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 md:gap-2.5">
            <button
              type="button"
              onClick={edit}
              aria-label={`Cambiar tu nombre, ahora «${shown}»`}
              // `truncate` recorta lo que se sale de la caja, y en Plus Jakarta 800 con tracking
              // negativo el trazo de letras como la «F» asoma un poco: 4 px de aire a los lados
              // (compensados con el margen) y algo más de interlineado para que no se coma nada.
              className="-mx-1 min-w-0 truncate rounded-lg px-1 py-0.5 font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-2xl"
            >
              {shown}
            </button>
            <button
              type="button"
              onClick={edit}
              aria-label="Cambiar tu nombre"
              className={cn(
                'flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isDesktop
                  ? 'h-8 rounded-[9px] bg-fill px-2.5 text-[13px] font-semibold hover:bg-control/40'
                  : 'size-7 hover:bg-fill',
              )}
            >
              <Pencil aria-hidden className="size-3.5" strokeWidth={2.2} />
              {isDesktop && <span aria-hidden>Cambiar</span>}
            </button>
          </div>
          <p className="mt-[3px] truncate text-[13px] text-muted-foreground md:mt-1 md:text-sm">
            {email}
            {fromEmail && (
              <span className="text-subtle-foreground"> · nombre tomado del email</span>
            )}
          </p>
        </div>
      )}
      {!isDesktop && (
        <NameSheet
          open={editing}
          name={shown}
          onSave={save}
          onClose={() => {
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
