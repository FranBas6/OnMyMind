import { ListIcon } from '@/components/ListIcon'

import { personName } from '../copy'
import { useInvitePreview } from '../hooks/useSharing'

/**
 * El rótulo del acceso cuando llegas con un enlace de invitación (diseño 20, J1 y D6): «Fran te
 * invita a «Compras»», en el sitio de «Sácalo de la cabeza.». Solo si el enlace aún vale: si
 * caducó o se anuló, lo dice la pantalla del enlace después de entrar.
 */
export function InviteBanner({ token }: { token: string }) {
  const preview = useInvitePreview(token)
  const data = preview.data
  if (data?.status !== 'valid') return null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-tint px-4 py-3.5 text-primary-strong">
      <ListIcon
        name={data.listName ?? ''}
        color={data.listColor ?? 'indigo'}
        icon={data.listIcon}
        size="sm"
      />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">
          {personName(data.inviterName)} te invita a «{data.listName}»
        </p>
        <p className="text-[13px]">Entra o crea tu cuenta para unirte.</p>
      </div>
    </div>
  )
}
