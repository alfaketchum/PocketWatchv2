/** Renders the financial receipt as a canvas image blob for sharing. */

import { type ShareableStats, buildReceiptLines } from "./share-stats"
import { APP_NAME, LOGO_PATH } from "@/lib/brand"

const W = 1200
const H = 630


function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export async function renderReceiptImage(stats: ShareableStats): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const MONO = "'SF Mono', 'Cascadia Code', 'Consolas', monospace"

  const LABEL_COLOR = "#6b7280"
  const VALUE_COLOR = "#18181b"
  const MUTED = "#a1a1aa"
  const BORDER = "#e4e4e7"
  const ACCENT = "#6366f1"
  const ACCENT_END = "#818cf8"

  // ── Background ─────────────────────────────────────────────
  ctx.fillStyle = "#f4f4f5"
  ctx.fillRect(0, 0, W, H)

  // ── Card ───────────────────────────────────────────────────
  const cardX = 48
  const cardY = 32
  const cardW = W - 96
  const cardH = H - 64

  // Card shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.08)"
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 4
  roundRect(ctx, cardX, cardY, cardW, cardH, 20)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Card border
  roundRect(ctx, cardX, cardY, cardW, cardH, 20)
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 1
  ctx.stroke()

  const px = cardX + 52
  const contentW = cardW - 104

  // ── Header ─────────────────────────────────────────────────
  const headerY = cardY + 40

  // Logo icon (no background bubble)
  const logoSize = 40
  ctx.save()
  ctx.translate(px, headerY + 4)
  ctx.scale(2, 2)
  ctx.fillStyle = VALUE_COLOR
  ctx.fill(new Path2D(LOGO_PATH), "evenodd")
  ctx.restore()

  // Title
  ctx.fillStyle = VALUE_COLOR
  ctx.font = `600 30px ${FONT}`
  ctx.textBaseline = "middle"
  ctx.fillText(APP_NAME, px + logoSize + 16, headerY + logoSize / 2)

  // Subtitle
  ctx.fillStyle = MUTED
  ctx.font = `500 14px ${FONT}`
  ctx.textAlign = "right"
  ctx.letterSpacing = "3px"
  ctx.fillText("FLEX CARD", px + contentW, headerY + logoSize / 2)
  ctx.letterSpacing = "0px"
  ctx.textAlign = "left"

  // Divider
  const divY = headerY + logoSize + 24
  ctx.fillStyle = BORDER
  ctx.fillRect(px, divY, contentW, 1)

  // ── Receipt lines ──────────────────────────────────────────
  const lines = buildReceiptLines(stats)
  const rowH = 48
  const totalH = lines.length * rowH
  const startY = divY + 8 + (cardH - (divY - cardY) - 8 - 44 - totalH) / 2

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const y = startY + i * rowH

    // Separator
    if (i > 0) {
      ctx.fillStyle = "#f4f4f5"
      ctx.fillRect(px, y, contentW, 1)
    }

    // Label
    ctx.fillStyle = LABEL_COLOR
    ctx.font = `400 24px ${FONT}`
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"
    ctx.fillText(line.label, px, y + rowH / 2)

    // Value
    ctx.fillStyle = line.accent ?? VALUE_COLOR
    ctx.font = `600 20px ${MONO}`
    ctx.textAlign = "right"
    ctx.fillText(line.value, px + contentW, y + rowH / 2)
    ctx.textAlign = "left"
  }

  // ── Footer ─────────────────────────────────────────────────
  ctx.fillStyle = MUTED
  ctx.font = `400 14px ${FONT}`
  ctx.textAlign = "center"
  ctx.fillText(`${APP_NAME} \u00B7 Open Source \u00B7 Private \u00B7 Self-Hosted`, W / 2, cardY + cardH - 22)
  ctx.textAlign = "left"

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to generate receipt image"))
    }, "image/png")
  })
}

/** Download image blob as a file. */
export function downloadImage(blob: Blob, filename = "pocketwatch-flex-card.png") {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
