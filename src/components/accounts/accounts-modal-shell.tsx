"use client"

import type { ReactNode } from "react"
import { createPortal } from "react-dom"

interface AccountsModalShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

/**
 * Dialog frame for the directory's edit/add forms. Portaled to <body> so the
 * fixed overlay escapes transformed page-transition ancestors.
 */
export function AccountsModalShell({ title, onClose, children, footer }: AccountsModalShellProps) {
  if (typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounts-modal-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-card-border bg-card"
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
            className="inline-flex items-center rounded-md text-foreground-muted hover:text-foreground"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-card-border px-5 py-3">{footer}</div>
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
