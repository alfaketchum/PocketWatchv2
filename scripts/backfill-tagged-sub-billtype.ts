import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { SUBSCRIPTION_TAG } from "@/lib/finance/tags"

// A subscription the user affirmed via "Mark as subscription" (its transactions
// carry the subscription tag) should be typed "subscription" in the cards/bills
// section. Auto-detection stores billType once from the raw Plaid category, so
// SaaS like Cloudflare/Google Workspace/Postiz get stuck as "bill". This flips
// tagged active subs to billType "subscription" (billType is preserved once set,
// so it sticks). Dry-run by default; pass --apply to write.
const APPLY = process.argv.includes("--apply")
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  // Merchants the user has affirmed as subscriptions (subscription-tagged txns).
  const tagged = await db.financeTransaction.findMany({
    where: { tags: { has: SUBSCRIPTION_TAG } },
    select: { merchantName: true, name: true },
  })
  const taggedNames = new Set(tagged.map((t) => (t.merchantName ?? t.name).trim().toLowerCase()))

  const subs = await db.financeSubscription.findMany({
    where: { status: "active", NOT: { billType: "subscription" } },
    select: { id: true, merchantName: true, billType: true },
  })
  const targets = subs.filter((s) => taggedNames.has(s.merchantName.trim().toLowerCase()))

  console.log(`Active subs not typed "subscription": ${subs.length}; affirmed via tag: ${targets.length} — ${APPLY ? "APPLY" : "DRY RUN"}`)
  for (const s of targets) console.log(`  ${s.merchantName.padEnd(28)} ${String(s.billType)} -> subscription`)

  if (APPLY && targets.length) {
    await db.financeSubscription.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { billType: "subscription" },
    })
    console.log("APPLIED.")
  }
}

main().catch(console.error).finally(() => db.$disconnect())
