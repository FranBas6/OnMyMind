# auth

Autenticación con Supabase Auth (email y contraseña; Google en 1.16 y código por email en 1.17).

- `api.ts`: `signInWithPassword`, `signUp`, `signOut` (solo este dispositivo), `getSession`,
  `onAuthStateChange`. Los errores salen como `AuthFailure` con el mensaje ya traducido
  (`errors.ts`).
- `hooks/useSession.ts`: estado `loading | anonymous | authenticated` para la interfaz.
- `redirect.ts`: `safeRedirect`, que solo deja volver a rutas internas tras entrar.
- `components/`: `AuthLayout` (marca y eslogan), `AuthField`/`PasswordField`, `LoginForm`.

La guarda de las rutas privadas está en `src/routes/_authenticated.tsx` (`beforeLoad` con
`getSession` del contexto del router).
