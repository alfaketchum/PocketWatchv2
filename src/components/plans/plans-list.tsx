"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { useCreatePlan, useDeletePlan, usePlansList, useUpdatePlanMeta } from "@/hooks/plans/use-plans-list"
import type { PlanListItem } from "@/hooks/plans/shared"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { MAX_PLANS_PER_USER } from "@/lib/plans/plan-constants"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { ImportPreviewDialog } from "./import-preview-dialog"
import { PlanCard, type PlanCardAction } from "./plan-card"
import { PlanNameDialog } from "./plan-name-dialog"

type NewSource = "import" | "blank"

const SOURCE_OPTIONS: { value: NewSource; label: string }[] = [
  { value: "import", label: "Start from my data" },
  { value: "blank", label: "Blank" },
]

type Dialog =
  | { kind: "new" }
  | { kind: "import"; name: string }
  | { kind: "duplicate"; plan: PlanListItem }
  | { kind: "rename"; plan: PlanListItem }
  | { kind: "delete"; plan: PlanListItem }
  | null

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[190px] animate-shimmer rounded-2xl" />
      ))}
    </div>
  )
}

/** All plans as cards, with create / duplicate / rename / primary / delete. */
export function PlansList() {
  const router = useRouter()
  const { isHidden } = usePrivacyMode()
  const list = usePlansList()
  const create = useCreatePlan()
  const updateMeta = useUpdatePlanMeta()
  const remove = useDeletePlan()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [source, setSource] = useState<NewSource>("import")
  const plans = list.data?.plans ?? []
  const atLimit = plans.length >= MAX_PLANS_PER_USER

  const onAction = (action: PlanCardAction, plan: PlanListItem) => {
    if (action === "primary") updateMeta.mutate({ id: plan.id, isPrimary: true })
    else setDialog({ kind: action, plan })
  }

  const createNew = (name: string) => {
    if (source === "import") {
      setDialog({ kind: "import", name })
      return
    }
    create.mutate({ from: "blank", name }, { onSuccess: ({ plan }) => router.push(`/plans/${plan.id}`) })
  }

  const createImported = (name: string, document: PlanDocument) =>
    create.mutate({ from: "import", name, document }, { onSuccess: ({ plan }) => router.push(`/plans/${plan.id}`) })

  const duplicate = (original: PlanListItem, name: string) =>
    create.mutate(
      { from: "duplicate", name, sourcePlanId: original.id },
      {
        onSuccess: () => {
          toast.success(`Created "${name}"`)
          setDialog(null)
        },
      },
    )

  if (list.isLoading) return <ListSkeleton />
  if (list.error) {
    return <EmptyState icon="error" variant="error" title="Couldn't load plans" description={list.error.message} action={{ label: "Retry", onClick: () => list.refetch() }} />
  }

  return (
    <div className="space-y-4">
      {plans.length === 0 ? (
        <EmptyState
          icon="route"
          title="No plans yet"
          description="A plan is your own model of the years ahead: accounts, income, spending, and when things change. Make copies to compare what-ifs."
          action={{ label: "Create your first plan", onClick: () => setDialog({ kind: "new" }) }}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <button type="button" onClick={() => setDialog({ kind: "new" })} disabled={atLimit} className="btn-primary text-sm disabled:opacity-50">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                add
              </span>
              New plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} isHidden={isHidden} onAction={onAction} />
            ))}
          </div>
        </>
      )}

      {dialog?.kind === "new" && (
        <PlanNameDialog
          title="New plan"
          initialName={plans.length === 0 ? "My plan" : `Plan ${plans.length + 1}`}
          submitLabel={source === "import" ? "Next" : "Create"}
          isPending={create.isPending}
          onSubmit={createNew}
          onClose={() => setDialog(null)}
        >
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground-muted">Start with</p>
            <ChoiceChips label="Start with" options={SOURCE_OPTIONS} value={source} onChange={setSource} />
            <p className="text-[11px] text-foreground-muted">
              {source === "import"
                ? "Copies today's balances, debts, income and spending from your linked accounts, once."
                : "An empty plan you fill in by hand."}
            </p>
          </div>
        </PlanNameDialog>
      )}
      {dialog?.kind === "import" && (
        <ImportPreviewDialog
          initialName={dialog.name}
          isPending={create.isPending}
          onCreate={createImported}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "duplicate" && (
        <PlanNameDialog
          title="Duplicate plan"
          initialName={`${dialog.plan.name} (copy)`}
          submitLabel="Duplicate"
          isPending={create.isPending}
          onSubmit={(name) => duplicate(dialog.plan, name)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "rename" && (
        <PlanNameDialog
          title="Rename plan"
          initialName={dialog.plan.name}
          submitLabel="Rename"
          isPending={updateMeta.isPending}
          onSubmit={(name) => updateMeta.mutate({ id: dialog.plan.id, name }, { onSuccess: () => setDialog(null) })}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.kind === "delete" && remove.mutate(dialog.plan.id, { onSuccess: () => setDialog(null) })}
        title={dialog?.kind === "delete" ? `Delete "${dialog.plan.name}"?` : "Delete plan?"}
        description="This permanently removes the plan and everything in it."
        confirmLabel="Delete"
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  )
}
