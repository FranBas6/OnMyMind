import { cn } from '@/lib/utils'

/** El arco que gira de los estados de espera del acceso (diseño 11: G3, K2 y K6). */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      className={cn('size-4 animate-spin', className)}
    >
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
    </svg>
  )
}
