import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { duplicateIdsToDelete } from "@/lib/finance/subscription-dedupe"

// Collapse duplicate FinanceSubscription rows (same user+merchant+amount+frequency)
// left behind by concurrent detection runs. Dry-run by default; --apply to delete.
const APPLY = process.argv.includes("--apply")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== Dedupe subscriptions — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`)

  const users = await db.financeSubscription.findMany({
    distinct: ["userId"],
    select: { userId: true },
  })

  let totalDeleted = 0
  for (const { userId } of users) {
    const rows = await db.financeSubscription.findMany({
      where: { userId },
      select: {
        id: true, merchantName: true, amount: true, frequency: true, status: true,
        lastTransactionId: true, nickname: true, notes: true, createdAt: true,
      },
    })
    const ids = duplicateIdsToDelete(rows)
    if (ids.length === 0) continue

    const byId = new Map(rows.map((r) => [r.id, r]))
    console.log(`user ${userId} — ${ids.length} duplicate row(s) to delete:`)
    for (const id of ids) {
      const r = byId.get(id)!
      console.log(`  DELETE "${r.merchantName}" $${r.amount} ${r.frequency} [${r.status}] id=${id}`)
    }
    totalDeleted += ids.length

    if (APPLY) {
      await db.financeSubscription.deleteMany({ where: { id: { in: ids } } })
    }
  }

  console.log(`\n${APPLY ? "DELETED" : "Would delete"} ${totalDeleted} duplicate row(s).`)
  console.log(APPLY ? "APPLIED.\n" : "DRY RUN complete — re-run with --apply to write.\n")
}

main().catch(console.error).finally(() => db.$disconnect())
