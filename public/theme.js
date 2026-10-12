// Aplica el tema guardado por next-themes (clave "theme") antes de pintar, para que no haya
// parpadeo al abrir la app. En una SPA el script que inyecta next-themes nunca se ejecuta. Va en un
// archivo, no en línea en index.html: la Content Security Policy solo deja scripts de la app (5.6).
;(function () {
  try {
    var theme = localStorage.getItem('theme') || 'system'
    var dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  } catch {
    // Sin `localStorage` (navegación privada): el tema del sistema.
  }
})()
