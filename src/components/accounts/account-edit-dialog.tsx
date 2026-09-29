"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useUpdateAccount, type UpdateAccountInput } from "@/hooks/accounts"
import type {
  DirectoryEmail,
  DirectoryPaymentAccount,
  DirectoryService,
} from "@/types/accounts-directory"
import { CATEGORY_OPTIONS, categoryLabel } from "./accounts-constants"
import { paidWithLabel } from "./accounts-helpers"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "./accounts-modal-shell"

interface AccountEditDialogProps {
  service: DirectoryService
  email: DirectoryEmail
  paymentAccounts: DirectoryPaymentAccount[]
  onClose: () => void
}

/** Edit one service/email pair: name, category, email, and which card pays for it. */
export function AccountEditDialog({ service, email, paymentAccounts, onClose }: AccountEditDialogProps) {
  const update = useUpdateAccount()
  const [name, setName] = useState(service.name)
  const [category, setCategory] = useState(service.category ?? "")
  const [address, setAddress] = useState(email.email)
  const [paymentAccountId, setPaymentAccountId] = useState(email.paymentAccountId ?? "")

  const handleSave = () => {
    const patch: UpdateAccountInput = { id: email.id }
    if (name.trim() && name.trim() !== service.name) patch.serviceName = name.trim()
    if ((category || null) !== service.category) patch.category = category || null
    if (address.trim() && address.trim() !== email.email) patch.accountEmail = address.trim()
    if ((paymentAccountId || null) !== email.paymentAccountId) {
      patch.paymentAccountId = paymentAccountId || null
    }
    if (Object.keys(patch).length === 1) {
      onClose()
      return
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.success(`Updated ${patch.serviceName ?? service.name}`)
        onClose()
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
    })
  }

  return (
    <AccountsModalShell
      title={`Edit ${service.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={update.isPending} className="btn-primary">
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <ModalField label="Service name" htmlFor="edit-name">
        <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} maxLength={60} />
      </ModalField>
      <ModalField label="Category" htmlFor="edit-category">
        <select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLASS}>
          <option value="">None</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </ModalField>
      <ModalField label="Signed up with" htmlFor="edit-email">
        <input id="edit-email" type="email" value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLASS} />
      </ModalField>
      <ModalField
        label="Paid with"
        htmlFor="edit-paid-with"
        hint="Automatic uses receipts, subscriptions and your charges. Pick a card to override."
      >
        <select
          id="edit-paid-with"
          value={paymentAccountId}
          onChange={(e) => setPaymentAccountId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Automatic</option>
          {paymentAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {paidWithLabel(a)} · {a.institution}
            </option>
          ))}
        </select>
      </ModalField>
    </AccountsModalShell>
  )
}
