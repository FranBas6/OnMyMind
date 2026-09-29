import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: 'Escribe un email válido.' }))

/** Entrar: solo se exige que haya contraseña; la longitud mínima se comprueba al crear la cuenta. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Escribe tu contraseña.' }),
})

export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH, {
    error: `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  }),
})

/** Cambiar la contraseña desde Perfil (1.13): la nueva, con el mínimo de siempre, y repetida. */
export const changePasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, {
      error: `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    error: 'Las contraseñas no coinciden.',
    path: ['confirm'],
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>

/** Búsqueda de `/login`: a dónde volver tras entrar, la variante y si Google volvió sin sesión. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(['signup']).optional(),
  error: z.enum(['google']).optional().catch(undefined),
})

export type AuthMode = NonNullable<z.infer<typeof authSearchSchema>['mode']>

/**
 * Búsqueda de `/auth/callback`: lo que la app puso en `redirectTo` y lo que añade Supabase. Con
 * PKCE vuelve `?code=` (supabase-js lo canjea al arrancar) o, si algo falla, `?error=`.
 */
export const callbackSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(['signup']).optional().catch(undefined),
  code: z.string().optional(),
  error: z.string().optional(),
})
