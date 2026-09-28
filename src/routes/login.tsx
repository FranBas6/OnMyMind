import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'

import { AuthLayout, authSearchSchema, LoginForm, safeRedirect, SignUpForm } from '@/features/auth'

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

/** Acceso: «Entrar» por defecto y «Crear cuenta» con `?mode=signup`; ambas conservan `redirect`. */
function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const goToDestination = () => {
    void navigate({ href: safeRedirect(search.redirect), replace: true })
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
        <SignUpForm onSuccess={goToDestination} />
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
            search={(prev) => ({ ...prev, mode: 'signup' as const })}
            className={footerLinkClassName}
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm onSuccess={goToDestination} />
    </AuthLayout>
  )
}
