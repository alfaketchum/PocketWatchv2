"use client"

import { memo } from "react"
import { HEADER_NAV_ID, HEADER_TOOLS_ID } from "./header-tools"
import { ViewControls } from "./view-controls"

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
}

/** Top bar on every page: menu button on phones, a page's own tools and tabs (if any), global view controls on the right. */
export const Header = memo(function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header
      className="min-h-12 sticky top-0 z-30 bg-background-secondary mobile-header md:static md:bg-transparent"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-3 px-4 md:pt-3 max-w-[1700px] mx-auto">
        <div className="flex min-w-0 flex-1 items-center gap-4 lg:flex-none lg:shrink-0">
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-background-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 active:opacity-70"
          >
            <span className="material-symbols-rounded text-xl text-foreground-muted" aria-hidden="true">menu</span>
          </button>

          {title && (
            <h1 className="text-sm font-semibold text-foreground">
              {title}
            </h1>
          )}
          <div id={HEADER_TOOLS_ID} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 empty:hidden" />
        </div>
        <div id={HEADER_NAV_ID} className="hidden min-w-0 flex-1 justify-center lg:flex" />
        <div className="ml-auto shrink-0">
          <ViewControls />
        </div>
      </div>
    </header>
  )
})

Header.displayName = "Header"
