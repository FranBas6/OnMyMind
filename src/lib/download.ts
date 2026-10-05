/**
 * Descarga un archivo hecho en el navegador (exportar, 2.8): un enlace con `download` a un `Blob`.
 * En el iPhone, Safari pregunta si descargarlo y queda en Archivos › Descargas.
 */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Safari necesita la URL viva un momento después del clic.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}
