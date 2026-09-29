"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useFireMode } from "@/hooks/finance/use-fire-profile"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { FIRE_NAV_ITEMS } from "@/hooks/use-sidebar-prefs"
import { FireModeToggle } from "./fire-mode-toggle"

/** FIRE section header: title, Basic/Advanced toggle, privacy, and tabs (lab tab is Advanced-only). */
export function FireHeader() {
  const pathname = usePathname()
  const [mode, setMode] = useFireMode()
  const { isHidden, togglePrivacy } = usePrivacyMode()
  const tabs = mode === "advanced" ? FIRE_NAV_ITEMS : FIRE_NAV_ITEMS.filter((t) => t.href === "/fire")

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl text-foreground font-semibold">FIRE</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Financial independence, retire early — when, and how safely</p>
        </div>
        <div className="flex items-center gap-2">
          <FireModeToggle mode={mode} onChange={setMode} />
          <PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />
        </div>
      </div>
      {tabs.length > 1 && (
        <nav className="flex border-b border-card-border overflow-x-auto scrollbar-hide" role="tablist">
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap text-sm transition-colors",
                  active ? "text-primary border-b-primary font-medium" : "text-foreground-muted border-b-transparent hover:text-foreground",
                )}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{tab.icon}</span>
                {tab.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
