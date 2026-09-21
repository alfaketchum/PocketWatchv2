/**
 * One-time backfill: move existing ATM/cash withdrawals that were categorized
 * as "Transfer" into the "ATM/Cash" category (a cash expense).
 *
 * Reuses categorizeTransaction so the result matches what future syncs produce.
 * Only rows currently tagged "Transfer" whose re-categorization is "ATM/Cash"
 * are touched — genuine transfers are left alone.
 *
 * Usage:
 *   npx tsx scripts/backfill-atm-cash.ts          # dry run (prints what would change)
 *   npx tsx scripts/backfill-atm-cash.ts --apply  # writes the changes
 */
import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { categorizeTransaction } from "@/lib/finance/categorize"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const APPLY = process.argv.includes("--apply")

async function main() {
  const transfers = await db.financeTransaction.findMany({
    where: { category: "Transfer" },
    select: {
      id: true, merchantName: true, name: true, amount: true,
      plaidCategory: true, plaidCategoryPrimary: true,
      account: { select: { type: true, subtype: true } },
    },
  })

  const toUpdate = transfers.filter((tx) => {
    const result = categorizeTransaction({
      merchantName: tx.merchantName ?? "",
      rawName: tx.name,
      plaidCategory: tx.plaidCategory,
      plaidCategoryPrimary: tx.plaidCategoryPrimary,
      amount: tx.amount,
      accountType: tx.account?.type,
      accountSubtype: tx.account?.subtype ?? null,
    })
    return result.category === "ATM/Cash"
  })

  console.log(`\nScanned ${transfers.length} "Transfer" transactions.`)
  console.log(`${toUpdate.length} are ATM/cash withdrawals → "ATM/Cash".\n`)

  for (const tx of toUpdate.slice(0, 20)) {
    console.log(`  • ${(tx.merchantName ?? tx.name).slice(0, 48).padEnd(48)} ${tx.amount}`)
  }
  if (toUpdate.length > 20) console.log(`  … and ${toUpdate.length - 20} more`)

  if (!APPLY) {
    console.log(`\nDry run — no changes written. Re-run with --apply to update.\n`)
    return
  }

  if (toUpdate.length > 0) {
    const res = await db.financeTransaction.updateMany({
      where: { id: { in: toUpdate.map((t) => t.id) } },
      data: { category: "ATM/Cash", subcategory: "Withdrawal" },
    })
    console.log(`\nUpdated ${res.count} transactions to "ATM/Cash".\n`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
