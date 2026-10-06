"use client"

import { useState, useEffect } from "react"

/** Below Tailwind's `sm` breakpoint (640px): phone-width layouts. */
const NARROW_QUERY = "(max-width: 639px)"

/** A chart's y-axis width on phones: room for compact labels like "$1.2M", leaving the rest to the plot. */
export const NARROW_AXIS_WIDTH = 40

/**
 * True on phone-width screens, for sizing that CSS classes can't reach (chart axes, SVG layouts, tooltips).
 * Returns `false` on the server and during hydration, so the wide layout renders first.
 */
export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    setIsNarrow(mq.matches)

    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return isNarrow
}
