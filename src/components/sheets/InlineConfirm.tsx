/**
 * Confirmación pequeña dentro de una hoja, en lugar de otro diálogo encima: el texto, «Cancelar» y
 * el botón rojo. Anular el enlace o salir de una lista (diseño 20, S5 y M5) y cambiar el enlace del
 * Calendario (diseño 21, C4).
 */
export function InlineConfirm({
  title,
  text,
  confirmLabel,
  onCancel,
  onConfirm,
  pending = false,
  disabled = false,
}: {
  title?: string
  text: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  pending?: boolean
  disabled?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={title ?? text}
      className="rounded-2xl border border-border-soft bg-background p-4"
    >
      {title && <p className="mb-1 font-display text-lg font-extrabold">{title}</p>}
      <p className="text-[15px] leading-normal">{text}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-xl px-3.5 text-[15px] font-semibold text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending || disabled}
          onClick={onConfirm}
          className="h-11 rounded-xl bg-destructive px-4 font-display text-[15px] font-bold text-destructive-foreground outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
