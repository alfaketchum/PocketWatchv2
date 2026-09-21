import { useLayoutEffect, useState, type RefObject } from "react"

/**
 * Keep a left-aligned popover on screen. Returns true when a panel of `width`px
 * opening from the anchor's left edge would overflow the viewport's right edge,
 * signalling the caller to flip to right-alignment. Recomputes whenever `open`
 * flips and on viewport resize.
 */
export function usePopoverAlign(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  width: number,
): boolean {
  const [alignRight, setAlignRight] = useState(false)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const measure = () => {
      const el = anchorRef.current
      if (!el) return
      const { left } = el.getBoundingClientRect()
      setAlignRight(left + width > window.innerWidth - 8)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [open, anchorRef, width])

  return alignRight
}
