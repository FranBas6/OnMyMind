import { describe, expect, it } from 'vitest'

import {
  checkFile,
  fileName,
  fileSummary,
  formatFileSize,
  roomMessage,
  storageName,
  viewerHint,
} from './files'

function fileOf(name: string, type: string, size = 1000): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('documentos (files.ts, 6.1)', () => {
  it('el tamaño en palabras: KB por debajo de 1 MB, MB con un decimal', () => {
    expect(formatFileSize(86016)).toBe('84 KB')
    expect(formatFileSize(12 * 1024)).toBe('12 KB')
    expect(formatFileSize(100)).toBe('1 KB')
    expect(formatFileSize(1258291)).toBe('1,2 MB')
    expect(formatFileSize(8 * 1024 * 1024)).toBe('8 MB')
  })

  it('su línea: el tipo en palabras y el tamaño', () => {
    expect(fileSummary({ mime: 'application/pdf', sizeBytes: 1258291 })).toBe('PDF · 1,2 MB')
    expect(
      fileSummary({
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: 86016,
      }),
    ).toBe('Excel · 84 KB')
  })

  it('vale por el tipo o, si no lo dice, por la extensión', () => {
    const pdf = checkFile(fileOf('Plan.pdf', 'application/pdf'))
    expect(pdf.ok && pdf.checked.mime).toBe('application/pdf')
    const docx = checkFile(fileOf('Condiciones.docx', ''))
    expect(docx.ok && docx.checked.mime).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const csv = checkFile(fileOf('Movimientos.csv', 'application/octet-stream'))
    expect(csv.ok && csv.checked.mime).toBe('text/csv')
  })

  it('no vale: una foto (a «+ Foto»), otro tipo o más de 5 MB', () => {
    expect(checkFile(fileOf('Recibo.HEIC', ''))).toEqual({
      ok: false,
      photo: true,
      message: '“Recibo.HEIC” es una foto. Añádela con «+ Foto».',
    })
    expect(checkFile(fileOf('Copias.zip', 'application/zip'))).toMatchObject({
      ok: false,
      photo: false,
    })
    expect(checkFile(fileOf('Escrituras.pdf', 'application/pdf', 8 * 1024 * 1024))).toEqual({
      ok: false,
      photo: false,
      message: '“Escrituras.pdf” pesa 8 MB. El máximo es 5 MB.',
    })
  })

  it('el nombre: sin espacios de más y, si es muy largo, con su extensión', () => {
    expect(fileName('  Plan   de ahorro.pdf ')).toBe('Plan de ahorro.pdf')
    const long = fileName(`${'a'.repeat(250)}.pdf`)
    expect(long).toHaveLength(200)
    expect(long.endsWith('.pdf')).toBe(true)
  })

  it('en Storage, sin tildes ni símbolos que no admite', () => {
    expect(storageName('Póliza 2025-2026.pdf')).toBe('Poliza 2025-2026.pdf')
    expect(storageName('Año «nuevo» & más.docx')).toBe('Ano -nuevo- - mas.docx')
    expect(storageName('???')).toBe('-')
  })

  it('cuántos caben', () => {
    expect(roomMessage(0, 2)).toBe('Has llegado a 5 documentos. Quita alguno para añadir otro.')
    expect(roomMessage(2, 4)).toBe('Solo cabían 2 más: se han subido los 2 primeros de los 4.')
    expect(roomMessage(1, 3)).toBe('Solo cabía 1 más: se ha subido el primero de los 3.')
  })

  it('dónde se abre, en el iPhone y en el iPad', () => {
    expect(viewerHint('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(
      'en el visor del iPhone',
    )
    expect(viewerHint('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(
      'en el visor del iPad',
    )
    expect(viewerHint('Mozilla/5.0 (Linux; Android 14)', 5)).toBeNull()
  })
})
