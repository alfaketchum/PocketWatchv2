import { z } from "zod"
import { db } from "@/lib/db"
import { REAL_ASSET_KINDS } from "./real-assets"

const money = z.number().min(0).max(1e10)
const date = z.coerce.date()

export const realAssetCreateSchema = z.object({
  kind: z.enum(REAL_ASSET_KINDS as [string, ...string[]]),
  name: z.string().trim().min(1).max(80),
  value: money,
  appreciation: z.number().min(-0.5).max(1),
  purchasePrice: money.nullable().optional(),
  purchaseDate: date.nullable().optional(),
  loanAccountId: z.string().max(50).nullable().optional(),
})

export const realAssetUpdateSchema = realAssetCreateSchema.partial()

/** Loan accounts a home or vehicle can be linked to: the user's own mortgages and loans. */
export async function loadLoanAccounts(userId: string) {
  return db.financeAccount.findMany({
    where: { userId, isHidden: false, type: { in: ["loan", "mortgage"] } },
    select: { id: true, name: true, currentBalance: true, subtype: true },
    orderBy: { name: "asc" },
    take: 100,
  })
}

/** Whether `loanAccountId` (when given) is one of the user's own loan accounts. */
export async function isOwnLoan(userId: string, loanAccountId: string | null | undefined): Promise<boolean> {
  if (!loanAccountId) return true
  const found = await db.financeAccount.findFirst({ where: { id: loanAccountId, userId, type: { in: ["loan", "mortgage"] } }, select: { id: true } })
  return found !== null
}

/** Midnight UTC today: value updates are kept one per day. */
export function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
