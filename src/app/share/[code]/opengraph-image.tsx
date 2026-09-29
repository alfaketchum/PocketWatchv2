import { ImageResponse } from "next/og"
import { decodeShareStats, buildReceiptLines } from "@/lib/share-stats"
import { APP_NAME, LOGO_PATH } from "@/lib/brand"

export const runtime = "edge"
export const alt = `${APP_NAME} Flex Card`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"


export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const stats = decodeShareStats(code)

  if (!stats) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f5", color: "#18181b", fontSize: 32 }}>
        {APP_NAME}
      </div>,
      { ...size },
    )
  }

  const lines = buildReceiptLines(stats)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f4f5",
        padding: "32px 48px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: 20,
          padding: "40px 52px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="32" height="32" viewBox="0 0 16 16" fill="#18181b">
              <path fillRule="evenodd" d={LOGO_PATH} />
            </svg>
            <span style={{ color: "#18181b", fontSize: 24, fontWeight: 600 }}>
              {APP_NAME}
            </span>
          </div>
          <span style={{ color: "#a1a1aa", fontSize: 14, fontWeight: 500, letterSpacing: "0.15em" }}>
            FLEX CARD
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#e4e4e7", marginBottom: 8 }} />

        {/* Receipt lines */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 0",
                borderTop: i > 0 ? "1px solid #f4f4f5" : "none",
              }}
            >
              <span style={{ color: "#6b7280", fontSize: 20, fontWeight: 400 }}>
                {line.label}
              </span>
              <span
                style={{
                  color: line.accent ?? "#18181b",
                  fontSize: 20,
                  fontWeight: 600,
                  fontFamily: "monospace",
                }}
              >
                {line.value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <span style={{ color: "#a1a1aa", fontSize: 14 }}>
            {APP_NAME} · Open Source · Private · Self-Hosted
          </span>
        </div>
      </div>
    </div>,
    { ...size },
  )
}
