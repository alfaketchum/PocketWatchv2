"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface AccountsModalShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  /** Wider frame for tables. */
  wide?: boolean
}

/**
 * Dialog frame for the directory's edit/add forms. Portaled to <body> so the
 * fixed overlay escapes transformed page-transition ancestors. On phones it is a
 * bottom sheet; Escape closes it and the page behind doesn't scroll.
 */
export function AccountsModalShell({ title, onClose, children, footer, wide }: AccountsModalShellProps) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  if (typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounts-modal-title"
        className={`flex max-h-[92dvh] w-full sm:max-h-[90dvh] ${wide ? "max-w-3xl" : "max-w-md"} flex-col overflow-hidden rounded-t-2xl border border-b-0 border-card-border bg-card sm:rounded-2xl sm:border-b`}
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
          <h2 id="accounts-modal-title" className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-target -mr-2 inline-flex items-center rounded-md text-foreground-muted hover:text-foreground sm:mr-0"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}

/** Labelled form row used inside the dialogs. */
export function ModalField({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-foreground-muted">{hint}</p>}
    </div>
  )
}

export const INPUT_CLASS =
  "w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
