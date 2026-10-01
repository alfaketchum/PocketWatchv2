"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { toast } from "sonner"

interface UndoToastProps {
  id: string | number
  message: string
  durationMs: number
  onUndo: () => void
}

/**
 * "Removed X · Undo" with a bar that empties as time runs out. The bar is a CSS animation (no re-render per tick)
 * and pauses with the toast: sonner holds its timer while hovered or while the page is hidden.
 */
function UndoToast({ id, message, durationMs, onUndo }: UndoToastProps) {
  const [hovered, setHovered] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden")
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-[min(356px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-md)] border border-card-border bg-card text-foreground"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="material-symbols-rounded shrink-0 text-foreground-muted" style={{ fontSize: 18 }} aria-hidden="true">
          delete
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">{message}</p>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(id)
            onUndo()
          }}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          Undo
        </button>
      </div>
      <div
        aria-hidden="true"
        className="pw-undo-countdown absolute bottom-0 left-0 h-[3px] w-full origin-left bg-primary"
        style={
          {
            animationDuration: `${durationMs}ms`,
            animationPlayState: hovered || hidden ? "paused" : "running",
            "--pw-undo-ms": `${durationMs}ms`,
          } as CSSProperties
        }
      />
    </div>
  )
}

/** Shows an undo toast for `durationMs`; returns its id so the caller can dismiss it early. */
export function showUndoToast({ message, durationMs, onUndo }: Omit<UndoToastProps, "id">): string | number {
  return toast.custom((id) => <UndoToast id={id} message={message} durationMs={durationMs} onUndo={onUndo} />, { duration: durationMs })
}
