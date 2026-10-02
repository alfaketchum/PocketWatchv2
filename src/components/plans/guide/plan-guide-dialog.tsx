"use client"

import { useState } from "react"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { PLAN_GUIDE } from "./plan-guide-content"

/** "How it works": a short bulleted guide to the plan's tabs, chart and pages. */
export function PlanGuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
          help
        </span>
        How it works
      </button>
      {open && (
        <AccountsModalShell
          title="How your plan works"
          wide
          onClose={() => setOpen(false)}
          footer={
            <button type="button" onClick={() => setOpen(false)} className="btn-primary text-sm">
              Got it
            </button>
          }
        >
          {PLAN_GUIDE.map((section) => (
            <section key={section.title} className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{section.title}</h3>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.name} className="flex gap-2 text-xs leading-relaxed">
                    <span className="text-foreground-muted" aria-hidden="true">•</span>
                    <span>
                      <span className="font-medium text-foreground">{item.name}:</span>{" "}
                      <span className="text-foreground-muted">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </AccountsModalShell>
      )}
    </>
  )
}
