import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { POSITION_STEP } from '@/lib/reorder'
import { queryKeys } from '@/lib/queryKeys'

import { MAX_PHOTOS, signedPhotoUrl, SIGNED_URL_SECONDS, uploadItemPhoto } from '../photos'
import type { Item, ItemImage } from '../types'

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

/** Una foto que se está subiendo (o que no se pudo subir). */
export interface PendingPhoto {
  key: string
  preview: string
  file: File
  status: 'uploading' | 'error'
  /** Su sitio entre las fotos. */
  position: number
  /** «Cambiar» (en el visor): la foto a la que sustituye. */
  replaces: string | null
}

/**
 * Subir fotos a una cosa (2a.6, diseño 15, M9 y M10; 4.5, diseño 23, D3 y D4). Varias a la vez,
 * hasta llegar a 10: mientras suben se ven al final con un velo; al terminar cada una se añade a
 * sus fotos (`onUploaded`), o sustituye a la que se cambió (`onReplaced`). Si falla, queda en rojo
 * con «Reintentar» y «Quitar». No va en la cola de cambios sin red: sin conexión, «+ Foto» lo dice
 * y no deja empezar.
 */
export function usePhotoUploads(
  item: Item,
  {
    onUploaded,
    onReplaced,
  }: {
    onUploaded: (image: ItemImage) => void
    onReplaced: (imageId: string, path: string) => void
  },
) {
  const [pending, setPending] = useState<PendingPhoto[]>([])

  const set = (key: string, change: Partial<PendingPhoto> | null) => {
    setPending((current) =>
      change === null
        ? current.filter((photo) => photo.key !== key)
        : current.map((photo) => (photo.key === key ? { ...photo, ...change } : photo)),
    )
  }

  const run = async (photo: PendingPhoto) => {
    set(photo.key, { status: 'uploading' })
    try {
      const path = await uploadItemPhoto(item.id, photo.file)
      if (photo.replaces) onReplaced(photo.replaces, path)
      else onUploaded({ id: crypto.randomUUID(), path, position: photo.position })
      set(photo.key, null)
      URL.revokeObjectURL(photo.preview)
    } catch {
      set(photo.key, { status: 'error' })
    }
  }

  const adding = pending.filter((photo) => photo.replaces === null).length
  /** Cuántas caben aún. */
  const room = Math.max(0, MAX_PHOTOS - item.images.length - adding)

  const begin = (photos: PendingPhoto[]) => {
    setPending((current) => [...current, ...photos])
    for (const photo of photos) void run(photo)
  }

  return {
    pending,
    room,
    /** Las elegidas, hasta las que quepan, al final y en su orden. */
    add: (files: readonly File[]) => {
      const last = Math.max(
        0,
        ...item.images.map((image) => image.position),
        ...pending.map((photo) => photo.position),
      )
      begin(
        files.slice(0, room).map((file, index) => ({
          key: crypto.randomUUID(),
          preview: URL.createObjectURL(file),
          file,
          status: 'uploading',
          position: last + (index + 1) * POSITION_STEP,
          replaces: null,
        })),
      )
    },
    /** «Cambiar»: la nueva va en el sitio de la de antes. */
    replace: (image: ItemImage, file: File) => {
      begin([
        {
          key: crypto.randomUUID(),
          preview: URL.createObjectURL(file),
          file,
          status: 'uploading',
          position: image.position,
          replaces: image.id,
        },
      ])
    },
    retry: (key: string) => {
      const photo = pending.find((entry) => entry.key === key)
      if (photo) void run(photo)
    },
    discard: (key: string) => {
      const photo = pending.find((entry) => entry.key === key)
      if (photo) URL.revokeObjectURL(photo.preview)
      set(key, null)
    },
  }
}
