import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { queryKeys } from '@/lib/queryKeys'

import { signedPhotoUrl, SIGNED_URL_SECONDS, uploadItemPhoto } from '../photos'
import type { Item, ItemPatch } from '../types'

/**
 * La imagen que se enseña de un ítem: su foto propia (URL firmada de Storage) o, si no la tiene,
 * la de la página de su enlace («De la web», diseño 15). `null` si no hay ninguna.
 */
export function usePhotoSrc(
  item: Pick<Item, 'imagePath' | 'imageUrl'>,
  size: 'thumb' | 'full',
): { src: string | null; fromWeb: boolean } {
  const path = item.imagePath
  const signed = useQuery({
    queryKey: queryKeys.photo(path ?? '', size),
    queryFn: () => signedPhotoUrl(path ?? '', size),
    enabled: path !== null,
    staleTime: (SIGNED_URL_SECONDS - 24 * 60 * 60) * 1000,
    gcTime: SIGNED_URL_SECONDS * 1000,
  })
  if (path) return { src: signed.data ?? null, fromWeb: false }
  return { src: item.imageUrl, fromWeb: item.imageUrl !== null }
}

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; preview: string; file: File }
  | { status: 'error'; preview: string; file: File }

/**
 * Subir la foto de un ítem (diseño 15, M9 y M10). Mientras sube se ve la foto elegida con un velo;
 * al terminar se guarda su ruta (`image_path`) y deja de valer la imagen de la web. Si falla, queda
 * la foto en rojo con «Reintentar» y «Quitar». No va en la cola de cambios sin red: sin conexión,
 * «+ Foto» lo dice y no deja empezar.
 */
export function usePhotoUpload(item: Item, onUpdate: (item: Item, patch: ItemPatch) => void) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })

  const run = async (file: File, preview: string) => {
    setState({ status: 'uploading', preview, file })
    try {
      const imagePath = await uploadItemPhoto(item.id, file)
      onUpdate(item, { imagePath, imageUrl: null })
      setState({ status: 'idle' })
      URL.revokeObjectURL(preview)
    } catch {
      setState({ status: 'error', preview, file })
    }
  }

  return {
    state,
    start: (file: File) => {
      void run(file, URL.createObjectURL(file))
    },
    retry: () => {
      if (state.status === 'error') void run(state.file, state.preview)
    },
    discard: () => {
      if (state.status !== 'idle') URL.revokeObjectURL(state.preview)
      setState({ status: 'idle' })
    },
  }
}
