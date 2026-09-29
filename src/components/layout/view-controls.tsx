"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"

/** Global display controls shown top-right on every page: light/dark and hide balances. */
export function ViewControls() {
  const { isHidden, togglePrivacy } = usePrivacyMode()
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-card-border bg-card p-0.5">
      <ThemeToggle />
      <button
        type="button"
        onClick={togglePrivacy}
        className="flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        title={isHidden ? "Show balances" : "Hide balances"}
        aria-label={isHidden ? "Show balances" : "Hide balances"}
        aria-pressed={isHidden}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
          {isHidden ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  )
}
