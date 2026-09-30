"use client"

import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { applyProfile, PATTERN_PROFILES, type PatternProfile } from "@/lib/plans/plan-spending-patterns"
import type { PlanEditorProps } from "../plans-helpers"
import { MENU_PANEL, OptionList, type ChipOption, type ChipTone } from "./chip-menu"

const PROFILE_TONE: Record<PatternProfile, ChipTone> = {
  typical: "primary",
  frontload: "success",
  conservative: "error",
  frugal: "warning",
  reset: "neutral",
}

const OPTIONS: ChipOption<PatternProfile>[] = PATTERN_PROFILES.map((p) => ({ value: p.key, label: p.label, hint: `${p.hint}.`, tone: PROFILE_TONE[p.key] }))

/** Sets patterns on every spending line at once from a profile; each line can still be changed after. */
export function PatternProfileMenu({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const [open, setOpen] = useState(false)
  const pick = (profile: PatternProfile) => {
    const { changed } = applyProfile(doc, profile)
    update((d) => applyProfile(d, profile).doc)
    setOpen(false)
    const label = PATTERN_PROFILES.find((p) => p.key === profile)?.label ?? profile
    toast.success(changed > 0 ? `${label}: updated ${changed} line${changed === 1 ? "" : "s"}` : `${label}: nothing to change`)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn-secondary text-xs">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            elderly
          </span>
          Spending profiles
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            expand_more
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={4} className={cn(MENU_PANEL, "w-80 p-1")}>
          <p className="px-2 pb-1 pt-1.5 text-[11px] text-foreground-muted">Set every line at once. You can still change any line after.</p>
          <OptionList label="Spending profiles" options={OPTIONS} onPick={pick} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
