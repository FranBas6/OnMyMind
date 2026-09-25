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

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>

/** Búsqueda de `/login` y `/auth/callback`: a dónde volver tras entrar y, en `/login`, la variante. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(['signup']).optional(),
})
