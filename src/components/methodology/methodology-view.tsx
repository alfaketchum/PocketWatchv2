"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { GUIDE_SECTIONS } from "./methodology-guide"
import { MARKET_SECTIONS } from "./methodology-markets"
import { PLAN_SECTIONS } from "./methodology-plans"
import { TAX_SECTIONS } from "./methodology-taxes"
import { WATCH_SECTION } from "./methodology-watchlist"
import type { MethodBlock, MethodSection } from "./methodology-types"

const SECTIONS: MethodSection[] = [...PLAN_SECTIONS, ...TAX_SECTIONS, ...MARKET_SECTIONS, WATCH_SECTION]

/** Renders **bold** spans inside a line of copy. */
function rich(text: string): ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

function Block({ block }: { block: MethodBlock }) {
  switch (block.kind) {
    case "text":
      return <p className="text-sm leading-relaxed text-foreground-muted">{rich(block.text)}</p>
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground-muted marker:text-foreground-muted/60">
          {block.items.map((item) => <li key={item}>{rich(item)}</li>)}
        </ul>
      )
    case "formula":
      return (
        <div className="rounded-xl border border-card-border bg-background-secondary/60 px-4 py-3">
          <div className="font-mono text-[13px] text-foreground break-words">{block.formula}</div>
          {block.caption && <p className="mt-1 text-[11px] text-foreground-muted">{block.caption}</p>}
        </div>
      )
    case "note":
      return (
        <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-[13px] leading-relaxed text-foreground">
          <span className="material-symbols-rounded shrink-0 text-warning" style={{ fontSize: 18 }}>info</span>
          <p>{rich(block.text)}</p>
        </div>
      )
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-card-border text-[11px] uppercase tracking-wider text-foreground-muted">
                {block.head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-b border-card-border/60 last:border-0">
                  {row.map((cell, i) => <td key={i} className="py-2 pr-4 text-foreground">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Section({ section }: { section: MethodSection }) {
  return (
    <section id={section.id} className="scroll-mt-20 bg-card border border-card-border rounded-2xl p-5 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-rounded mt-0.5 text-primary" style={{ fontSize: 22 }}>{section.icon}</span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
          <p className="text-xs text-foreground-muted">{section.summary}</p>
        </div>
      </div>
      {section.blocks.map((block, i) => <Block key={i} block={block} />)}
      {section.sources && (
        <p className="text-[11px] text-foreground-muted">
          Sources:{" "}
          {section.sources.map((s, i) => (
            <Fragment key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.label}</a>
            </Fragment>
          ))}
        </p>
      )}
    </section>
  )
}

const PAGES = [
  { href: "/methodology/guide", label: "Your guide", icon: "explore" },
  { href: "/methodology", label: "How it's calculated", icon: "functions" },
] as const

/** Switch between the plain-language guide and the full methodology. */
function MethodologyTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Methodology pages" className="inline-flex rounded-lg border border-card-border p-0.5">
      {PAGES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={pathname === p.href ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
            pathname === p.href ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">{p.icon}</span>
          {p.label}
        </Link>
      ))}
    </nav>
  )
}

/** How every projection, tax and historical test in the app is calculated, in plain language. */
export function MethodologyView() {
  return <MethodPage subtitle="How we calculate your plans, taxes, stress tests and FIRE numbers, and what we leave out." sections={SECTIONS} />
}

/** The tax rules a plan applies, by stage of life: what's automatic, what you set and where, what isn't covered. */
export function MethodologyGuideView() {
  return <MethodPage subtitle="The tax rules your plan follows, stage by stage: what it does for you, what you set, and what it doesn't cover." sections={GUIDE_SECTIONS} />
}

function MethodPage({ subtitle, sections }: { subtitle: string; sections: MethodSection[] }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Methodology</h1>
          <p className="text-xs text-foreground-muted mt-0.5">{subtitle}</p>
        </div>
        <MethodologyTabs />
      </div>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="lg:sticky lg:top-20 lg:self-start">
          <ol className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-lg border border-card-border px-2.5 py-1 text-xs text-foreground-muted hover:text-foreground lg:border-0 lg:py-1.5"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{s.icon}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 space-y-4">
          {sections.map((s) => <Section key={s.id} section={s} />)}
        </div>
      </div>
    </div>
  )
}
