"use client"

import { memo, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { fadeIn, durations } from "@/lib/motion"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { SidebarNavSection } from "./sidebar-nav-section"
import { SidebarEditControls } from "./sidebar-edit-controls"
import { SidebarNetWorth } from "./sidebar-net-worth"
import {
  useSidebarPrefs,
  getOrderedItems,
  NAV_CATEGORIES,
} from "@/hooks/use-sidebar-prefs"
import { useReviewCount } from "@/hooks/use-finance"
import Link from "next/link"
import { LOGO_PATH } from "@/lib/brand"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  /** Desktop-only collapsed (icon-rail) state. */
  collapsed?: boolean
  /** Toggle the desktop collapsed state. */
  onToggleCollapse?: () => void
}

export const Sidebar = memo(function Sidebar({ isOpen = true, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: reviewCountData, refetch: refetchReviewCount } = useReviewCount()
  // The sidebar is mounted once in the persistent dashboard layout, so its
  // badge query never remounts to pick up changes — refetch on navigation so
  // the count stays current instead of going stale until a hard refresh.
  useEffect(() => { refetchReviewCount() }, [pathname, refetchReviewCount])
  const financeBadges = reviewCountData?.count ? { "fin-transactions": reviewCountData.count } : undefined
  const reduce = useReducedMotion()
  const {
    prefs,
    hydrated,
    isEditing,
    setIsEditing,
    moveItem,
    toggleVisibility,
    moveCategory,
    resetToDefaults,
  } = useSidebarPrefs()

  const handleLock = async () => {
    try {
      await fetch("/api/auth/lock", { method: "POST" })
    } catch {
      // Best-effort
    }
    window.location.href = "/"
  }

  // Collapsing exits edit mode so the reorder UI never renders inside the rail.
  const handleToggleCollapse = () => {
    setIsEditing(false)
    onToggleCollapse?.()
  }

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            className="fixed inset-0 bg-black/40 z-40 lg:hidden cursor-default"
            onClick={onClose}
            aria-label="Close navigation menu"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reduce || !hydrated ? { duration: 0 } : { duration: durations.base }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        data-app-sidebar
        className={cn(
          "fixed left-0 top-0 h-full w-64 border-r border-card-border z-50 transition-[transform,width] duration-200 lg:translate-x-0 flex flex-col",
          "bg-card",
          collapsed ? "lg:w-14" : "lg:w-64",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)", willChange: "transform" }}
      >
        {/* Logo + nav edit */}
        <div className={cn(
          "h-14 flex items-center justify-between px-4 border-b border-card-border flex-shrink-0",
          collapsed && "lg:px-0 lg:justify-center",
        )}>
          <Link
            href="/net-worth"
            onClick={onClose}
            aria-label="FlameFolio home"
            className={cn("flex items-center gap-2.5 rounded-lg hover:opacity-80 transition-opacity", collapsed && "lg:hidden")}
          >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-primary" aria-hidden="true">
                <path fillRule="evenodd" d={LOGO_PATH} />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Flame<span className="text-foreground-muted font-normal">Folio</span>
            </span>
          </Link>
          <div className={cn("flex items-center gap-1", collapsed && "lg:hidden")}>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "flex items-center justify-center w-9 h-9 lg:w-8 lg:h-8 rounded-lg transition-colors",
                isEditing
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
              aria-label="Customize sidebar"
              title="Customize sidebar"
            >
              <span className="material-symbols-rounded icon-md" aria-hidden="true">tune</span>
            </button>
            {/* Collapse — desktop only, expanded state */}
            {onToggleCollapse && (
              <button
                onClick={handleToggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <span className="material-symbols-rounded icon-md" aria-hidden="true">left_panel_close</span>
              </button>
            )}
          </div>
          {/* Expand — desktop only, collapsed state */}
          {onToggleCollapse && (
            <button
              onClick={handleToggleCollapse}
              className={cn(
                "hidden items-center justify-center w-8 h-8 rounded-lg transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary",
                collapsed && "lg:flex",
              )}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <span className="material-symbols-rounded icon-md" aria-hidden="true">left_panel_open</span>
            </button>
          )}
        </div>

        {/* Navigation or Edit Mode */}
        {isEditing ? (
          <SidebarEditControls
            prefs={prefs}
            moveItem={moveItem}
            toggleVisibility={toggleVisibility}
            moveCategory={moveCategory}
            resetToDefaults={resetToDefaults}
            onDone={() => setIsEditing(false)}
          />
        ) : (
          <nav className={cn("flex-1 py-4 px-3 space-y-0.5 overflow-y-auto overflow-x-visible", collapsed && "lg:px-2")} suppressHydrationWarning>
            {prefs.categoryOrder.map((catKey, idx) => {
              const category = NAV_CATEGORIES[catKey]
              if (!category) return null
              const items = getOrderedItems(catKey, prefs)
              if (items.length === 0) return null
              const baseHref = catKey === "finance" ? "/finance" : catKey === "fire" ? "/fire" : catKey === "plans" ? "/plans" : catKey === "accounts" ? "/accounts" : catKey === "travel" ? "/travel" : catKey === "ai" ? "/chat" : catKey === "product" ? "/roadmap" : catKey === "netWorth" ? "/net-worth" : "/portfolio"

              return (
                <div key={catKey}>
                  {idx > 0 && <div className="h-px bg-card-border mx-1 my-3 opacity-60" />}
                  <SidebarNavSection
                    label={category.label}
                    items={items}
                    pathname={pathname}
                    baseHref={baseHref}
                    onClose={onClose}
                    badges={catKey === "finance" ? financeBadges : undefined}
                    collapsed={collapsed}
                  />
                  {catKey === "netWorth" && <SidebarNetWorth collapsed={collapsed} />}
                </div>
              )
            })}
          </nav>
        )}

        {/* Bottom section */}
        <div className={cn("px-3 py-3 border-t border-card-border flex-shrink-0 space-y-2", collapsed && "lg:px-1")}>
          <div className={cn("flex items-center gap-1", collapsed && "lg:flex-col")}>
            <button
              onClick={handleLock}
              className="flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              aria-label="Lock"
              title="Lock"
            >
              <span className="material-symbols-rounded text-lg" aria-hidden="true">lock_open</span>
            </button>
            <div className={cn("w-px h-5 bg-card-border", collapsed && "lg:hidden")} />
            <NotificationBell />
            <div className={cn("w-px h-5 bg-card-border", collapsed && "lg:hidden")} />
            <button
              onClick={() => { router.push("/settings"); onClose?.() }}
              className={cn(
                "flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg transition-colors",
                pathname === "/settings"
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
              aria-label="System settings"
              title="System settings"
            >
              <span className="material-symbols-rounded text-lg" aria-hidden="true">settings</span>
            </button>
            <span className={cn("ml-auto text-[10px] text-foreground-muted/40 tabular-nums", collapsed && "lg:hidden")} title={`Build ${process.env.NEXT_PUBLIC_BUILD_HASH}`}>
              v{process.env.NEXT_PUBLIC_BUILD_VERSION}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
})

Sidebar.displayName = "Sidebar"
