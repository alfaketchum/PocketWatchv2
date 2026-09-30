"use client"

import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import * as Tooltip from "@radix-ui/react-tooltip"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { cn } from "@/lib/utils"

export type ChipTone = "neutral" | "success" | "warning" | "error" | "primary"

export interface ChipOption<T extends string> {
  value: T
  label: string
  /** What it means: shown on hover over the chip and under each choice in the menu. */
  hint: string
  tone?: ChipTone
}

const TONE: Record<ChipTone, { chip: string; dot: string }> = {
  neutral: { chip: "border-card-border bg-foreground/5 text-foreground", dot: "bg-foreground-muted" },
  success: { chip: "border-success/40 bg-success/10 text-success", dot: "bg-success" },
  warning: { chip: "border-warning/40 bg-warning/10 text-warning", dot: "bg-warning" },
  error: { chip: "border-error/40 bg-error/10 text-error", dot: "bg-error" },
  primary: { chip: "border-primary/40 bg-primary/10 text-primary", dot: "bg-primary" },
}

export const MENU_PANEL = "z-[60] rounded-lg border border-card-border bg-card shadow-lg"
const PANEL = MENU_PANEL

/** Choices with a colored dot, a label and what each means; `selected` is highlighted. */
export function OptionList<T extends string>({
  label,
  options,
  selected,
  onPick,
}: {
  label: string
  options: ChipOption<T>[]
  selected?: T
  onPick: (value: T) => void
}) {
  return (
    <div role="listbox" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={o.value === selected}
          onClick={() => onPick(o.value)}
          className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-foreground/5", o.value === selected && "bg-primary/5")}
        >
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[o.tone ?? "neutral"].dot)} />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-foreground">{o.label}</span>
            <span className="block text-[11px] leading-snug text-foreground-muted">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * A dropdown shaped like a colored chip. Hovering it explains the current choice; the menu lists every
 * choice with what it means.
 */
export function ChipMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ChipOption<T>[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const isTouch = useIsTouchDevice()
  const current = options.find((o) => o.value === value) ?? options[0]
  const chip = (
    <Popover.Trigger asChild>
      <button
        type="button"
        aria-label={`${label}: ${current.label}`}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium leading-4 transition-colors hover:brightness-95",
          TONE[current.tone ?? "neutral"].chip,
        )}
      >
        {current.label}
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          expand_more
        </span>
      </button>
    </Popover.Trigger>
  )
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {isTouch ? (
        chip
      ) : (
        <Tooltip.Provider delayDuration={250}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{chip}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="top" sideOffset={5} className={cn(PANEL, "max-w-xs px-3 py-2 text-xs text-foreground")}>
                <span className="font-semibold">{current.label}:</span> {current.hint}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={4} className={cn(PANEL, "w-72 p-1")}>
          <OptionList
            label={label}
            options={options}
            selected={value}
            onPick={(v) => {
              onChange(v)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
