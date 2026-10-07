"use client"

import * as Tooltip from "@radix-ui/react-tooltip"
import { useIsTouchDevice } from "@/hooks/use-touch-device"

/**
 * A short hover hint on a control that already does something when clicked (a chip, a toggle). Desktop only: on touch
 * a tap must still select, so the hint is skipped there; pair it with an info icon when touch users need it too.
 */
export function HoverHint({ hint, children }: { hint?: string; children: React.ReactElement }) {
  const isTouch = useIsTouchDevice()
  if (!hint || isTouch) return children
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={5} className="z-[60] max-w-xs rounded-lg border border-card-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
            {hint}
            <Tooltip.Arrow className="fill-card-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
