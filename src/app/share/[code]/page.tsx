import type { Metadata } from "next"
import { decodeShareStats, buildReceiptLines } from "@/lib/share-stats"
import { APP_NAME, LOGO_PATH } from "@/lib/brand"

interface SharePageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { code } = await params
  const stats = decodeShareStats(code)
  const desc = stats
    ? `Financial Health Score: ${stats.g} (${stats.s}/100) | OnlyFans Subscriber: ${stats.gn ? "POSITIVE" : "NEGATIVE"} | Savings Found: $${stats.sv.toLocaleString()}/yr`
    : "See everything you own. In one place."

  return {
    title: `${APP_NAME} Flex Card`,
    description: desc,
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { code } = await params
  const stats = decodeShareStats(code)

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f4f5" }}>
        <p className="text-lg" style={{ color: "#a1a1aa" }}>Invalid share link</p>
      </div>
    )
  }

  const lines = buildReceiptLines(stats)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#f4f4f5" }}
    >
      <div className="w-full max-w-lg">
        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden mb-8 shadow-lg"
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
          }}
        >
          <div className="px-8 pt-7 pb-5">
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-5">
              <svg width="32" height="32" viewBox="0 0 16 16" fill="#18181b">
                <path fillRule="evenodd" d={LOGO_PATH} />
              </svg>
              <div>
                <h1 className="text-xl font-semibold" style={{ color: "#18181b" }}>{APP_NAME}</h1>
                <p className="text-[11px] tracking-[0.15em]" style={{ color: "#a1a1aa" }}>FLEX CARD</p>
              </div>
            </div>

            <div className="h-px mb-3" style={{ background: "#e4e4e7" }} />

            {/* Lines */}
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3.5"
                style={{ borderTop: i > 0 ? "1px solid #f4f4f5" : "none" }}
              >
                <span className="text-[15px]" style={{ color: "#6b7280" }}>{line.label}</span>
                <span className="text-[15px] font-semibold font-mono" style={{ color: line.accent ?? "#18181b" }}>{line.value}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="py-3.5 text-center" style={{ borderTop: "1px solid #f4f4f5" }}>
            <span className="text-xs" style={{ color: "#a1a1aa" }}>{APP_NAME} · Open Source · Private · Self-Hosted</span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="https://github.com/viperrcrypto/pocketwatch"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 shadow-md"
            style={{ background: "#18181b", color: "#ffffff" }}
          >
            Get Your Receipt
          </a>
        </div>
      </div>
    </div>
  )
}
