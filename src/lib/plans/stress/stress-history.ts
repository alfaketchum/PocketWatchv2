import type { MarketHistory } from "@/lib/fire/fire-types"

const MONTHS = 12
/** First year of official CPI (BLS CPI-U); Shiller's earlier index is reconstructed from wholesale prices. */
export const CPI_RELIABLE_FROM = 1913

/** Calendar-year real returns from the monthly Shiller data (US stocks and bonds, total return, after inflation). */
export interface AnnualHistory {
  years: number[]
  stocks: number[]
  bonds: number[]
  /** CAPE in January of each year (null before it can be computed). */
  cape: (number | null)[]
  /** Inflation over each year, January to January (null when the dataset has no CPI for it). */
  inflation: (number | null)[]
  /** Average of ln(1 + real stock return): the compounded baseline crypto's swings are measured against. */
  stockLogMean: number
  latestCape: number
}

/** Compounds each complete calendar year's 12 monthly real returns; a partial last year is left out. */
export function annualHistory(h: MarketHistory): AnnualHistory {
  const years: number[] = []
  const stocks: number[] = []
  const bonds: number[] = []
  const cape: (number | null)[] = []
  const inflation: (number | null)[] = []
  for (let i = 0; i + MONTHS <= h.months.length; i += MONTHS) {
    if (!h.months[i].endsWith("-01")) continue
    let s = 1
    let b = 1
    for (let m = i; m < i + MONTHS; m++) {
      s *= 1 + h.equity[m]
      b *= 1 + h.bonds[m]
    }
    years.push(Number(h.months[i].slice(0, 4)))
    stocks.push(s - 1)
    bonds.push(b - 1)
    cape.push(h.cape[i])
    inflation.push(h.cpi && i + MONTHS < h.months.length ? h.cpi[i + MONTHS] / h.cpi[i] - 1 : null)
  }
  const stockLogMean = stocks.length > 0 ? stocks.reduce((t, v) => t + Math.log(1 + v), 0) / stocks.length : 0
  return { years, stocks, bonds, cape, inflation, stockLogMean, latestCape: h.latestCape }
}
