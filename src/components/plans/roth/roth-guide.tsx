"use client"

import { useEffect, useState, type ReactNode } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { ownTraditional, rmdStartAge } from "@/lib/plans/tax/retirement-rules-2026"
import type { PlanDocument } from "@/lib/plans/plan-types"

const OPEN_KEY = "pw:roth-guide-open"

const TERMS: { term: string; meaning: string }[] = [
  { term: "Traditional", meaning: "401(k)s and IRAs you got a tax break on going in. Every dollar is taxed as income when it comes out." },
  { term: "Roth", meaning: "Already taxed. It grows and comes out tax-free, has no required withdrawals for you, and passes to heirs untaxed." },
  { term: "Conversion", meaning: "Moving money from traditional to Roth. The amount counts as income that year, so you pay its tax now instead of later." },
  { term: "Bracket", meaning: "Federal tax goes up in steps (10%, 12%, 22%, 24%…). \"Fill the 22% bracket\" means convert until your income reaches the top of that step, and no further." },
  { term: "Required withdrawals", meaning: "From 73 or 75 (by birth year) the IRS makes you take a growing share out of traditional accounts each year and pay tax on it, whether you need the money or not." },
  { term: "Medicare IRMAA", meaning: "A surcharge on Medicare premiums from 65 when income is high, set by your income two years earlier. Big conversions from 63 can trigger it." },
  { term: "5-year rule", meaning: "Before 59½, each conversion has to sit in the Roth 5 years before you can take it out penalty-free." },
  { term: "After-tax net worth", meaning: "What's left at the end, minus the tax your heirs would owe on traditional money. It's how this page compares paying tax now with paying it later." },
]

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{n}</span>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-xs text-foreground-muted">{children}</p>
      </div>
    </li>
  )
}

/** Each person's traditional and Roth money today, and when their required withdrawals start. */
function YourSituation({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const owned = (id: string, i: number) => (a: PlanDocument["accounts"][number]) => a.owner === id || (a.owner === null && i === 0)
  const people = doc.people
    .map((p, i) => {
      const mine = doc.accounts.filter(owned(p.id, i))
      const traditional = mine.filter(ownTraditional).reduce((s, a) => s + a.balance, 0)
      const roth = mine.filter((a) => a.taxTreatment === "roth").reduce((s, a) => s + a.balance, 0)
      const rmdAge = rmdStartAge(p.birthYear)
      return { p, traditional, roth, rmdAge, rmdYear: p.birthYear + rmdAge }
    })
    .filter((x) => x.traditional > 0)
  if (people.length === 0) {
    return <p className="text-xs text-foreground-muted">This plan has no traditional accounts, so there&apos;s nothing to convert.</p>
  }
  return (
    <ul className="space-y-1.5">
      {people.map(({ p, traditional, roth, rmdAge, rmdYear }) => {
        const years = rmdYear - doc.settings.startYear
        return (
          <li key={p.id} className="text-xs text-foreground">
            <span className="font-semibold">{p.name}</span>: <span className="font-data" style={blur}>{fmtMoney(traditional)}</span> traditional,{" "}
            <span className="font-data" style={blur}>{fmtMoney(roth)}</span> Roth today. Required withdrawals start at {rmdAge}
            {years > 0 ? ` in ${rmdYear}, ${years} year${years === 1 ? "" : "s"} away` : ", already started"}.
          </li>
        )
      })}
    </ul>
  )
}

/** Plain-language guide to the page: the idea, when it pays, how to use it, and the terms. */
export function RothGuide({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false)
    } catch {
      // Storage can be unavailable (private mode); the guide just starts open.
    }
  }, [])
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0")
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
  return (
    <section className="bg-card border border-card-border rounded-2xl p-5 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-[10px] sm:text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Start here</p>
          <p className="text-sm font-semibold text-foreground mt-1">How Roth conversions work</p>
        </div>
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-5">
          <div className="space-y-2 text-xs text-foreground">
            <p>
              Money in traditional accounts hasn&apos;t been taxed yet. You&apos;ll pay income tax on it eventually: when you spend it, when the IRS forces it out
              from your 70s, or your heirs will. A conversion chooses <em>when</em>: pay the tax now, in a year your income is low, and that money grows tax-free
              in a Roth from then on.
            </p>
            <p className="text-foreground-muted">
              It&apos;s a bet on tax rates. It pays off when your rate now is lower than it would be later. It doesn&apos;t when converting pushes you into a
              higher bracket than you&apos;d pay anyway.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-card-border p-3 sm:p-4">
              <p className="text-xs font-semibold text-foreground mb-1.5">Usually worth it</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-foreground-muted">
                <li>The &quot;gap years&quot;: retired, before Social Security and required withdrawals, when income is low</li>
                <li>A big traditional balance that would force large required withdrawals later</li>
                <li>Heirs in a high bracket, or a spouse who&apos;ll file single later</li>
                <li>You can pay the tax from cash rather than from the conversion</li>
              </ul>
            </div>
            <div className="rounded-xl border border-card-border p-3 sm:p-4">
              <p className="text-xs font-semibold text-foreground mb-1.5">Usually not</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-foreground-muted">
                <li>While you&apos;re working and already in a high bracket</li>
                <li>A small traditional balance that low brackets will cover anyway</li>
                <li>You&apos;ll need the money within 5 years, before 59½</li>
                <li>Converting would push income over a Medicare IRMAA line from 63</li>
              </ul>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Your situation</p>
            <YourSituation doc={doc} isHidden={isHidden} />
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Using this page</p>
            <ol className="space-y-2.5">
              <Step n={1} title="Find the best strategy">Run the optimizer just below. It tries a couple of hundred ways to convert on your plan and ranks them.</Step>
              <Step n={2} title="Apply one">Apply puts it in as a conversion rule. Nothing is moved in real life: this is a plan.</Step>
              <Step n={3} title="Check the impact">The Impact card compares your plan with and without the conversions, and lists each year&apos;s conversion and the tax it adds.</Step>
              <Step n={4} title="Adjust if you like">Edit the rule: the bracket, the years, the IRMAA cap. Impact updates as you go.</Step>
            </ol>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-primary">Terms on this page</summary>
            <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {TERMS.map((t) => (
                <div key={t.term}>
                  <dt className="text-xs font-semibold text-foreground">{t.term}</dt>
                  <dd className="text-xs text-foreground-muted">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
    </section>
  )
}
