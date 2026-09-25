/**
 * Visually distinct colors for many chart bands, derived from the theme.
 *
 * The theme palette has 8 colors with near-duplicates (purple/violet, green/
 * mint), so 20 stacked bands would repeat and blur together. Instead, start from
 * the theme's primary color (keeping its saturation and lightness, so bands feel
 * on-brand in light and dark mode) and step the hue by the golden angle — each
 * new color lands in the largest remaining gap on the color wheel. Alternating
 * lightness makes adjacent bands stand apart even when hues are close.
 */

const GOLDEN_ANGLE = 137.508
const LIGHTNESS_STEPS = [0, 12, -10]

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`
}

/** `count` distinct colors anchored on the theme's primary color. */
export function distinctBandColors(primary: string, count: number): string[] {
  const base = hexToHsl(primary) ?? { h: 240, s: 60, l: 60 }
  // Keep enough saturation / mid lightness that every band reads as a color
  const s = Math.min(Math.max(base.s, 55), 80)
  const l = Math.min(Math.max(base.l, 50), 62)
  return Array.from({ length: count }, (_, i) =>
    hsl(base.h + i * GOLDEN_ANGLE, s, l + LIGHTNESS_STEPS[i % LIGHTNESS_STEPS.length]))
}
