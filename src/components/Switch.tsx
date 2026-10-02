import { Switch as RadixSwitch } from 'radix-ui'

import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  className?: string
}

/**
 * Interruptor (diseño 17, F1 y F5: «Todo el día»): una píldora de 50 × 30 px, en `primary`
 * encendida y en `control` apagada, con el círculo blanco que se desliza.
 */
export function Switch({ checked, onCheckedChange, label, className }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        'relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        checked ? 'bg-primary' : 'bg-control',
        className,
      )}
    >
      <RadixSwitch.Thumb className="block size-[26px] rounded-full bg-white shadow-xs transition-transform data-[state=checked]:translate-x-5" />
    </RadixSwitch.Root>
  )
}
