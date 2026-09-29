import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  AuthLayout,
  authSearchSchema,
  EmailCodeFlow,
  loadPendingCode,
  LoginForm,
  safeRedirect,
  SigningInScreen,
  SignUpForm,
  type EmailCodeStart,
} from '@/features/auth'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  // Con sesión, el acceso no pinta nada: directo a donde ibas (o a Inicio).
  beforeLoad: async ({ context, search }) => {
    if (await context.getSession()) {
      throw redirect({ href: safeRedirect(search.redirect) })
    }
  },
  component: LoginPage,
})

const footerLinkClassName = 'font-semibold text-primary hover:text-primary-hover'

/** Lo que enseña el acceso: el formulario, el código por email o «Entrando…» tras el código. */
type AccessView = { kind: 'form' } | { kind: 'code'; start: EmailCodeStart } | { kind: 'entering' }

/**
 * Acceso: «Entrar» por defecto y «Crear cuenta» con `?mode=signup`; ambas conservan `redirect`.
 * `?error=google` llega de `/auth/callback` cuando Google vuelve sin sesión. El código por email
 * (1.17) va en la misma ruta; si había uno pedido y aún vale, se vuelve directo a sus casillas.
 */
function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [view, setView] = useState<AccessView>(() => {
    const pending = loadPendingCode(Date.now())
    return pending ? { kind: 'code', start: { step: 'code', ...pending } } : { kind: 'form' }
  })

  const goToDestination = () => {
    void navigate({ href: safeRedirect(search.redirect), replace: true })
  }

  const openCode = (email: string) => {
    setView({ kind: 'code', start: { step: 'email', email } })
  }

  if (view.kind === 'entering') return <SigningInScreen via="email" />

  if (view.kind === 'code') {
    return (
      <EmailCodeFlow
        mode={search.mode}
        start={view.start}
        onExit={() => {
          setView({ kind: 'form' })
        }}
        onSignedIn={() => {
          setView({ kind: 'entering' })
          goToDestination()
        }}
      />
    )
  }

  if (search.mode === 'signup') {
    return (
      <AuthLayout
        footer={
          <>
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              search={(prev) => ({ redirect: prev.redirect })}
              className={footerLinkClassName}
            >
              Entrar
            </Link>
          </>
        }
      >
        <SignUpForm
          onSuccess={goToDestination}
          redirect={search.redirect}
          googleFailed={search.error === 'google'}
          onUseCode={openCode}
          onNeedsCode={(email) => {
            setView({
              kind: 'code',
              start: { step: 'code', email, sentAt: Date.now(), confirming: true },
            })
          }}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      footer={
        <>
          ¿Primera vez?{' '}
          <Link
            to="/login"
            search={(prev) => ({ redirect: prev.redirect, mode: 'signup' as const })}
            className={footerLinkClassName}
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm
        onSuccess={goToDestination}
        redirect={search.redirect}
        googleFailed={search.error === 'google'}
        onUseCode={openCode}
      />
    </AuthLayout>
  )
}
