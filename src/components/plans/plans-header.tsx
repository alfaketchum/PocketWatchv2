"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { PLANS_NAV_ITEMS } from "@/hooks/use-sidebar-prefs"

/** Plans section header: title and section tabs. Hidden inside a single plan, which has its own header. */
export function PlansHeader() {
  const pathname = usePathname()
  const sectionPage = PLANS_NAV_ITEMS.some((t) => t.href === pathname)
  if (!sectionPage) return null

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl text-foreground font-semibold">Blueprint</h1>
        <p className="text-xs text-foreground-muted mt-0.5">
          Your retirement, mapped year by year: accounts, income, spending and what-if plans
        </p>
      </div>
      {PLANS_NAV_ITEMS.length > 1 && (
        <nav className="flex border-b border-card-border overflow-x-auto scrollbar-hide" role="tablist">
          {PLANS_NAV_ITEMS.map((tab) => {
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
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
