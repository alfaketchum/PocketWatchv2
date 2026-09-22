import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Move existing auto-detected active subscriptions into the "suggested" queue so
// the user confirms/dismisses them under the new model. Manual (user-marked)
// subs are left active. Dry-run by default; --apply to write.
const APPLY = process.argv.includes("--apply")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== Move active auto subs → suggested — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`)

  const subs = await db.financeSubscription.findMany({
    where: { status: "active", NOT: { detectionMethod: "manual" } },
    select: { id: true, merchantName: true, amount: true, detectionMethod: true },
  })
  console.log(`Active non-manual subscriptions → suggested: ${subs.length}\n`)
  for (const s of subs) {
    console.log(`  ${s.merchantName.slice(0, 40).padEnd(40)} $${s.amount}  [${s.detectionMethod ?? "null"}]`)
  }

  if (APPLY && subs.length) {
    await db.financeSubscription.updateMany({
      where: { status: "active", NOT: { detectionMethod: "manual" } },
      data: { status: "suggested", detectionMethod: "auto" },
    })
  }

  console.log(`\n${APPLY ? "APPLIED." : "DRY RUN complete — re-run with --apply to write."}\n`)
}

main().catch(console.error).finally(() => db.$disconnect())
