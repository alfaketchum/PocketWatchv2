"use client"

import { useState, type ReactNode } from "react"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "@/components/accounts/accounts-modal-shell"

interface PlanNameDialogProps {
  title: string
  initialName: string
  submitLabel: string
  isPending: boolean
  onSubmit: (name: string) => void
  onClose: () => void
  children?: ReactNode
}

/** Name a plan: used for new plans, copies and renames. */
export function PlanNameDialog({ title, initialName, submitLabel, isPending, onSubmit, onClose, children }: PlanNameDialogProps) {
  const [name, setName] = useState(initialName)
  const trimmed = name.trim()
  const submit = () => {
    if (trimmed && !isPending) onSubmit(trimmed)
  }

  return (
    <AccountsModalShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!trimmed || isPending} className="btn-primary text-sm disabled:opacity-50">
            {isPending ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <ModalField label="Plan name" htmlFor="plan-name">
        <input
          id="plan-name"
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={INPUT_CLASS}
        />
      </ModalField>
      {children}
    </AccountsModalShell>
  )
}
