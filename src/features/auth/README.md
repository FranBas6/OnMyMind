# auth

Autenticación con Supabase Auth (email y contraseña; Google en 1.16 y código por email en 1.17).

- `api.ts`: `signInWithPassword`, `signUp`, `signInWithGoogle` (sale a Google y vuelve a
  `/auth/callback` con PKCE), `signOut` (solo este dispositivo), `getSession`,
  `onAuthStateChange`. Los errores salen como `AuthFailure` con el mensaje ya traducido
  (`errors.ts`).
- `hooks/useSession.ts`: estado `loading | anonymous | authenticated` para la interfaz.
- `hooks/useGoogleSignIn.ts`: estado del botón de Google («Abriendo Google…», se limpia al volver
  con «atrás») y su error, que el formulario pinta en su línea de siempre.
- `redirect.ts`: `safeRedirect`, que solo deja volver a rutas internas tras entrar.
- `components/`: `AuthLayout` (marca y eslogan), `AuthField`/`PasswordField`, `LoginForm`,
  `SignUpForm`, `GoogleButton`/`OrSeparator` y `SigningInScreen` («Entrando…» de la vuelta).

La guarda de las rutas privadas está en `src/routes/_authenticated.tsx` (`beforeLoad` con
`getSession` del contexto del router).
