"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useCreateAccount } from "@/hooks/accounts"
import type { DirectoryPaymentAccount } from "@/types/accounts-directory"
import { CATEGORY_OPTIONS, categoryLabel } from "./accounts-constants"
import { paidWithLabel } from "./accounts-helpers"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "./accounts-modal-shell"

export interface AccountAddDefaults {
  serviceName?: string
  serviceDomain?: string
  paymentAccountId?: string | null
}

interface AccountAddDialogProps {
  defaults: AccountAddDefaults
  knownEmails: string[]
  paymentAccounts: DirectoryPaymentAccount[]
  onClose: () => void
}

/** Add a service by hand — e.g. a subscription whose signup email wasn't found. */
export function AccountAddDialog({ defaults, knownEmails, paymentAccounts, onClose }: AccountAddDialogProps) {
  const create = useCreateAccount()
  const [name, setName] = useState(defaults.serviceName ?? "")
  const [domain, setDomain] = useState(defaults.serviceDomain ?? "")
  const [email, setEmail] = useState(knownEmails[0] ?? "")
  const [category, setCategory] = useState("")
  const [paymentAccountId, setPaymentAccountId] = useState(defaults.paymentAccountId ?? "")

  const handleSave = () => {
    if (!name.trim() || !domain.trim() || !email.trim()) {
      toast.error("Name, website and email are required")
      return
    }
    create.mutate(
      {
        serviceName: name.trim(),
        serviceDomain: domain.trim(),
        accountEmail: email.trim(),
        category: category || null,
        paymentAccountId: paymentAccountId || null,
      },
      {
        onSuccess: () => {
          toast.success(`Added ${name.trim()}`)
          onClose()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add account"),
      },
    )
  }

  return (
    <AccountsModalShell
      title="Add account"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={create.isPending} className="btn-primary">
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <ModalField label="Service name" htmlFor="add-name">
        <input id="add-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} maxLength={60} placeholder="Netflix" />
      </ModalField>
      <ModalField label="Website" htmlFor="add-domain">
        <input id="add-domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={INPUT_CLASS} placeholder="netflix.com" />
      </ModalField>
      <ModalField label="Signed up with" htmlFor="add-email">
        <input id="add-email" type="email" list="add-email-options" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
        <datalist id="add-email-options">
          {knownEmails.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </ModalField>
      <ModalField label="Category" htmlFor="add-category">
        <select id="add-category" value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLASS}>
          <option value="">None</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </ModalField>
      <ModalField label="Paid with" htmlFor="add-paid-with">
        <select id="add-paid-with" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={INPUT_CLASS}>
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
