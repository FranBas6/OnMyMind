const HOME = '/'

/**
 * Ruta interna a la que volver tras entrar. Solo acepta rutas de la propia app: `?redirect=`
 * viene de la URL y cualquiera puede escribirla, así que un valor como `//evil.com` o
 * `https://evil.com` convertiría el login en un trampolín a otra web (open redirect).
 */
export function safeRedirect(target: string | undefined): string {
  if (!target?.startsWith('/')) return HOME
  // `//host` y `/\host` los navegadores los interpretan como otra web.
  if (target.startsWith('//') || target.startsWith('/\\')) return HOME
  // Volver al propio acceso tras entrar no tiene sentido.
  if (target.startsWith('/login') || target.startsWith('/auth/')) return HOME
  return target
}
