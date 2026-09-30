import { db } from "@/lib/db"
import type { ValuedAsset } from "./real-assets"

/** Most homes/vehicles a user can add; also bounds every list query. */
export const MAX_REAL_ASSETS = 50
/** Value updates kept per asset for history. */
export const MAX_VALUES_PER_ASSET = 500

export const REAL_ASSET_SELECT = {
  id: true,
  kind: true,
  name: true,
  value: true,
  valueAsOf: true,
  appreciation: true,
  purchasePrice: true,
  purchaseDate: true,
  loanAccountId: true,
  values: { select: { date: true, value: true }, orderBy: { date: "asc" as const }, take: MAX_VALUES_PER_ASSET },
} as const

export type StoredRealAsset = ValuedAsset & { id: string; name: string; loanAccountId: string | null }

export async function loadRealAssets(userId: string): Promise<StoredRealAsset[]> {
  return db.realAsset.findMany({
    where: { userId },
    select: REAL_ASSET_SELECT,
    orderBy: { createdAt: "asc" },
    take: MAX_REAL_ASSETS,
  })
}
