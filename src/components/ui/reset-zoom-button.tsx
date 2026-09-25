"use client"

/** Small overlay button shown on a chart while it's zoomed in. */
export function ResetZoomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-card-border bg-card/90 px-2 py-1 text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors"
      title="Reset zoom (or double-click the chart)"
    >
      <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">zoom_out_map</span>
      Reset zoom
    </button>
  )
}
