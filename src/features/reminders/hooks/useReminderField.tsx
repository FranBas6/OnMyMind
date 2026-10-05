import { Bell, BellOff, Check } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { isRecurrence } from '@/features/items/events'
import { Row, Value } from '@/features/items/components/FieldRow'
import type { Item } from '@/features/items/types'
import { useOnline } from '@/hooks/useOnline'

import { usePush } from './usePush'
import { reminderFor, useItemReminder, useSetReminder, type ReminderChoice } from './useReminders'
import { dismissPrompt, promptDismissed } from '../push'
import { canHaveReminder, deviceName, reminderPhrase, reminderRowLabel } from '../reminders'
import { PushPrompt, type PushPromptKind } from '../components/PushPrompt'
import { CustomReminder, ReminderNote, ReminderOptions } from '../components/ReminderPanels'

interface ReminderFieldProps {
  item: Item
  isDesktop: boolean
}

/**
 * El aviso de una tarea o un evento en su ficha (diseño 18, R1–R17 y D1–D2). Devuelve la fila,
 * para meterla en la caja que toca («Cuándo» de un evento, debajo de Repetir; la de «Fecha
 * límite» de una tarea), y la línea de debajo de esa caja. La fila abre las opciones (hoja en el
 * móvil, popover en escritorio), cada una con cuándo sonaría; lo que ya pasó sale en gris.
 * «Personalizado…» elige día y hora en la misma hoja. El primer aviso en un dispositivo sin
 * avisos pregunta si activarlos (A1).
 */
export function useReminderField({ item, isDesktop }: ReminderFieldProps): {
  row: ReactNode
  note: ReactNode
} {
  const reminder = useItemReminder(item.id)
  const setReminder = useSetReminder()
  const push = usePush()
  const online = useOnline()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [prompt, setPrompt] = useState<PushPromptKind | null>(null)
  const device = deviceName(navigator.userAgent, navigator.maxTouchPoints)

  if (!canHaveReminder(item)) return { row: null, note: null }

  const state = push.state
  const close = () => {
    setOpen(false)
    setCustom(false)
  }

  const choose = (choice: ReminderChoice | null) => {
    const next = choice ? reminderFor(item, choice, reminder) : null
    setReminder.mutate({ item, next })
    if (isDesktop || choice === null) close()
    if (!choice) return
    // El primer aviso en un dispositivo que aún no los recibe: preguntar aquí mismo (A1, A6).
    const ask: PushPromptKind | null =
      state === 'off' && !promptDismissed()
        ? 'activate'
        : state === 'needs-install' && !promptDismissed()
          ? 'install'
          : null
    if (ask) {
      close()
      setPrompt(ask)
    }
  }

  const silent = reminder !== undefined && state !== undefined && state !== 'on'
  const sent = reminder?.sentAt != null && !isRecurrence(item.recurrence)
  const row = (
    <Row
      icon={silent ? BellOff : Bell}
      iconClassName={reminder && !sent && !silent ? 'text-primary' : undefined}
      label="Aviso"
      highlighted={open}
      onClick={() => {
        setOpen(true)
      }}
    >
      {!reminder ? (
        <span className="text-muted-foreground">Sin aviso</span>
      ) : sent ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Check aria-hidden className="size-3.5" strokeWidth={2.4} />
          Avisado · {reminderRowLabel(reminder, item).split(' · ').at(-1)}
        </span>
      ) : (
        <Value>{reminderRowLabel(reminder, item)}</Value>
      )}
    </Row>
  )

  const panel = custom ? (
    <CustomReminder
      item={item}
      reminder={reminder}
      isDesktop={isDesktop}
      onDone={(remindAt) => {
        choose({ remindAt })
        close()
      }}
      onBack={() => {
        setCustom(false)
      }}
    />
  ) : (
    <ReminderOptions
      item={item}
      reminder={reminder}
      state={state}
      isDesktop={isDesktop}
      onChoose={choose}
      onCustom={() => {
        setCustom(true)
      }}
      onDone={close}
    />
  )

  const picker = isDesktop ? (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
    >
      <Popover.Anchor asChild>{row}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label="Aviso"
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[340px] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
        >
          {panel}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  ) : (
    <>
      {row}
      <BottomSheet
        nested
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title="Aviso"
      >
        {panel}
      </BottomSheet>
    </>
  )

  const promptSheet = (
    <PushPrompt
      kind={prompt}
      onKindChange={(next) => {
        if (prompt === 'activate' && next === null) dismissPrompt()
        setPrompt(next)
      }}
      device={device}
      reminder={reminder && { title: item.title, phrase: reminderPhrase(reminder, item) }}
      isDesktop={isDesktop}
      nested={!isDesktop}
    />
  )

  return {
    row: (
      <>
        {picker}
        {promptSheet}
      </>
    ),
    note: reminder && (
      <ReminderNote
        item={item}
        reminder={reminder}
        state={state}
        online={online}
        device={device}
        onPrompt={setPrompt}
      />
    ),
  }
}
