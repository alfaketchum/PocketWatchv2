import type { ReactNode } from "react"
import { APP_NAME } from "@/lib/brand"

export interface LegalSection {
  heading: string
  body: string[]
}

interface LegalPageProps {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  children?: ReactNode
}

/** Public, unauthenticated legal page (privacy policy, terms) with shared layout. */
export function LegalPage({ title, lastUpdated, sections, children }: LegalPageProps) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-8 text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-foreground-muted">Last updated {lastUpdated}</p>
      </header>

      {sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-medium">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-foreground-muted">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {children}

      <footer className="pt-4 border-t border-card-border flex gap-4 text-xs text-foreground-muted">
        <span>{APP_NAME}</span>
        <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
        <a href="/terms" className="hover:text-foreground">Terms of Service</a>
      </footer>
    </main>
  )
}
