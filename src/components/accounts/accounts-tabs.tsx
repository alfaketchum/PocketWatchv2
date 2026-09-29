"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/accounts", label: "Directory", icon: "alternate_email" },
  { href: "/accounts/senders", label: "Unsubscribe", icon: "unsubscribe" },
] as const

/** Switch between the account directory and the unsubscribe manager. */
export function AccountsTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Accounts sections" className="flex items-center gap-0.5 self-start rounded-lg border border-card-border bg-background-secondary p-0.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
