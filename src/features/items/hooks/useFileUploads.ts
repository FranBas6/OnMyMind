import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { POSITION_STEP } from '@/lib/reorder'
import { queryKeys } from '@/lib/queryKeys'

import {
  checkFile,
  FILE_URL_SECONDS,
  MAX_FILES,
  roomMessage,
  signedFileUrls,
  uploadItemFile,
  type CheckedFile,
} from '../files'
import type { Item, ItemFile } from '../types'

/** Un documento que se está subiendo (o que no se pudo subir), con lo que va al guardarlo. */
export interface PendingFile {
  key: string
  checked: CheckedFile
  status: 'uploading' | 'error'
  /** De 0 a 1: «Subiendo… 60 %». */
  progress: number
  position: number
  /** Ya subido: su ruta, mientras se guarda en la cosa. */
  path?: string
}

/** Lo que dice la línea bajo la caja (X1–X4); `photo` resalta «+ Foto» (X2). */
export interface FileProblem {
  message: string
  photo: boolean
}

/**
 * Subir documentos a una cosa (6.1, diseño 29, F3, X1–X5): cada uno sale en la caja mientras sube,
 * con su porcentaje y la ✕ para cancelarlo; al terminar se guarda en sus documentos (`onUploaded`,
 * que avisa si no se pudo guardar), y deja de estar pendiente cuando la cosa ya lo trae: así la caja
 * no desaparece un momento entre medias.
 * Si falla, se queda con «Reintentar» y la ✕. Lo que no vale (el tipo, el tamaño, una foto, que no
 * quepa) no se sube y lo dice `problem`. Como las fotos, no va en la cola sin red: sin conexión,
 * «+ Documento» lo dice y no deja empezar.
 */
export function useFileUploads(
  item: Item,
  onUploaded: (file: ItemFile, onFailed: () => void) => void,
) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [problem, setProblem] = useState<FileProblem | null>(null)
  const aborts = useRef(new Map<string, AbortController>())

  const set = (key: string, change: Partial<PendingFile> | null) => {
    setPending((current) =>
      change === null
        ? current.filter((entry) => entry.key !== key)
        : current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)),
    )
  }

  const run = async (entry: PendingFile) => {
    const controller = new AbortController()
    aborts.current.set(entry.key, controller)
    set(entry.key, { status: 'uploading', progress: 0 })
    try {
      const path = await uploadItemFile(item.id, entry.checked, {
        signal: controller.signal,
        onProgress: (progress) => {
          set(entry.key, { progress })
        },
      })
      set(entry.key, { path, progress: 1 })
      onUploaded(
        {
          id: crypto.randomUUID(),
          path,
          name: entry.checked.name,
          mime: entry.checked.mime,
          sizeBytes: entry.checked.file.size,
          position: entry.position,
        },
        // No se pudo guardar: el aviso ya lo dice y lo subido lo recoge la limpieza.
        () => {
          set(entry.key, null)
        },
      )
    } catch (error) {
      // Cancelado con la ✕: ya no está.
      if (error instanceof DOMException && error.name === 'AbortError') return
      set(entry.key, { status: 'error' })
    } finally {
      aborts.current.delete(entry.key)
    }
  }

  // Lo que la cosa ya trae deja de estar pendiente (guardar es optimista, pero no inmediato).
  const arrived = pending.filter(
    (entry) => entry.path !== undefined && item.files.some((file) => file.path === entry.path),
  )
  if (arrived.length > 0) {
    setPending((current) => current.filter((entry) => !arrived.some((a) => a.key === entry.key)))
  }
  const visible = pending.filter((entry) => !arrived.includes(entry))

  /** Cuántos caben aún, contando los que suben y los que fallaron. */
  const room = Math.max(0, MAX_FILES - item.files.length - visible.length)

  return {
    pending: visible,
    problem,
    room,
    /** Los elegidos: los que valen, hasta los que quepan, al final y en su orden. */
    add: (files: readonly File[]) => {
      const checks = files.map(checkFile)
      const valid = checks.flatMap((check) => (check.ok ? [check.checked] : []))
      const fitting = valid.slice(0, room)
      const rejected = checks.flatMap((check) => (check.ok ? [] : [check])).at(-1)
      setProblem(
        rejected
          ? { message: rejected.message, photo: rejected.photo }
          : valid.length > fitting.length
            ? { message: roomMessage(room, valid.length), photo: false }
            : null,
      )
      const last = Math.max(
        0,
        ...item.files.map((file) => file.position),
        ...pending.map((entry) => entry.position),
      )
      const entries = fitting.map((checked, index) => ({
        key: crypto.randomUUID(),
        checked,
        status: 'uploading' as const,
        progress: 0,
        position: last + (index + 1) * POSITION_STEP,
      }))
      setPending((current) => [...current, ...entries])
      for (const entry of entries) void run(entry)
    },
    retry: (key: string) => {
      const entry = pending.find((candidate) => candidate.key === key)
      if (entry) void run(entry)
    },
    /** La ✕: cancela el que sube, o quita el que falló. */
    discard: (key: string) => {
      aborts.current.get(key)?.abort()
      set(key, null)
    },
    clearProblem: () => {
      setProblem(null)
    },
  }
}

/**
 * Los enlaces para abrir los documentos de una cosa, pedidos de una vez al abrir su ficha: así,
 * tocar uno abre la pestaña al momento (con un enlace ya hecho no hace falta esperar, y el
 * navegador no lo toma por una ventana emergente). No se guardan con la caché (`private`): caducan.
 */
export function useFileUrls(files: readonly ItemFile[], online: boolean) {
  const paths = files.map((file) => file.path)
  return useQuery({
    queryKey: queryKeys.fileUrls(paths),
    queryFn: () => signedFileUrls(paths),
    enabled: paths.length > 0 && online,
    staleTime: (FILE_URL_SECONDS - 10 * 60) * 1000,
    gcTime: FILE_URL_SECONDS * 1000,
    meta: { private: true },
  })
}
