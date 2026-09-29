"use client"

/** Shown on Advanced-only FIRE tabs when the user is in Basic mode. */
export function FireAdvancedGate({ title, onSwitch }: { title: string; onSwitch: () => void }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
      <span className="material-symbols-rounded text-primary mb-2 block" style={{ fontSize: 32 }}>science</span>
      <p className="text-sm text-foreground font-semibold">{title}</p>
      <button type="button" className="btn-primary mt-4" onClick={onSwitch}>
        Switch to Advanced
      </button>
    </div>
  )
}
