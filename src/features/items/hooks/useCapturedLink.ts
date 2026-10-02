import { CancelledError, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useOnline } from '@/hooks/useOnline'
import { queryKeys } from '@/lib/queryKeys'

import type { LinkMetadata, NewItem } from '../api'
import { linkMetadataQueryOptions } from '../queries'
import type { Item, ItemPatch } from '../types'
import { itemFromNew, useUpdateItem } from './useItemMutations'
import { pricePatch, titlePatch } from './useLinkMetadata'

/**
 * Cómo va la página de un enlace pegado en la captura (diseño 16, K1–K5): buscándola (se puede
 * guardar ya), sin red (se guarda con el dominio), lista (con lo que dio, que puede ser nada) o la
 * función no contestó (como sin datos, pero el detalle lo volverá a intentar).
 */
export type LinkPreviewState = 'searching' | 'offline' | 'ready' | 'failed'

/**
 * La vista previa de un enlace en la captura (2.3). Es la misma consulta que la del detalle
 * (`linkMetadataQueryOptions`), así que lo que se mira aquí ya no se vuelve a pedir allí.
 */
export function useLinkPreview(url: string | null): {
  state: LinkPreviewState
  metadata: LinkMetadata | null
} {
  const online = useOnline()
  const query = useQuery({ ...linkMetadataQueryOptions(url ?? ''), enabled: url !== null })
  if (query.data) return { state: 'ready', metadata: query.data }
  if (!online || query.fetchStatus === 'paused') return { state: 'offline', metadata: null }
  if (query.isError && query.fetchStatus === 'idle') return { state: 'failed', metadata: null }
  return { state: 'searching', metadata: null }
}

/**
 * Lo capturado antes de que llegara la página (sin red, o guardado mientras se buscaba) se completa
 * solo cuando llega: el título de la página en vez del dominio, el nombre de la web, la imagen y,
 * en una compra, el precio. Sin red, la consulta espera y sale al volver la conexión; si la app se
 * cierra antes, lo completa el detalle al abrirlo (`useLinkMetadata`).
 */
export function useFillCapturedLink(): (item: NewItem) => void {
  const queryClient = useQueryClient()
  const { mutate: updateItem } = useUpdateItem()

  return useCallback(
    (item: NewItem) => {
      const url = item.link?.url
      if (!url || item.link?.urlTitle !== null) return
      const options = linkMetadataQueryOptions(url)
      // Sin red, la consulta de la vista previa está en pausa y se cancela al cerrarse la hoja,
      // que era quien la miraba: entonces se pide de nuevo, ya sin nadie que la cancele.
      queryClient
        .query(options)
        .catch((error: unknown) => {
          if (error instanceof CancelledError) return queryClient.query(options)
          throw error
        })
        .then(
          (data) => {
            const cached = queryClient
              .getQueryData<Item[]>(queryKeys.items.byList(item.listId))
              ?.find((entry) => entry.id === item.id)
            const current = cached ?? itemFromNew(item, 0)
            // Ya lo completó el detalle, o se quitó el enlace.
            if (current.url !== url || current.urlTitle !== null) return
            const patch: ItemPatch = titlePatch(current, data)
            if (current.kind === 'shopping' && current.priceCents === null && data.price) {
              Object.assign(patch, pricePatch(data.price))
            }
            updateItem({ item: current, patch })
          },
          // La función no contesta: se queda con el dominio y lo reintenta el detalle.
          () => undefined,
        )
    },
    [queryClient, updateItem],
  )
}
