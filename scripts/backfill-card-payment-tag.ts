import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { detectCCPayment } from "@/lib/finance/hard-rules"
import { CARD_PAYMENT_TAG } from "@/lib/finance/tags"

// Backfill the "card payments" tag onto existing transactions that the hard-rule
// CC-payment detector recognizes (payments toward a credit card). Mirrors the
// forward-only sync wiring. Dry-run by default; pass --apply to write.
const APPLY = process.argv.includes("--apply")
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const txns = await db.financeTransaction.findMany({
    select: {
      id: true, name: true, merchantName: true, amount: true, tags: true,
      plaidCategory: true, plaidCategoryPrimary: true,
      account: { select: { type: true, subtype: true } },
    },
  })

  const targets = txns.filter((t) => {
    if (t.tags.includes(CARD_PAYMENT_TAG)) return false
    const hit = detectCCPayment({
      rawName: t.name,
      merchantName: t.merchantName,
      amount: t.amount,
      accountType: t.account?.type ?? "depository",
      accountSubtype: t.account?.subtype ?? null,
      plaidCategoryPrimary: t.plaidCategoryPrimary,
      plaidCategory: t.plaidCategory,
    })
    return !!hit
  })

  console.log(`Card payments to tag: ${targets.length} / ${txns.length} scanned — ${APPLY ? "APPLY" : "DRY RUN"}`)
  for (const t of targets) console.log(`  ${(t.merchantName ?? t.name).slice(0, 40).padEnd(40)} ${t.amount}`)

  if (APPLY && targets.length) {
    await Promise.all(
      targets.map((t) =>
        db.financeTransaction.update({ where: { id: t.id }, data: { tags: [...t.tags, CARD_PAYMENT_TAG] } }),
      ),
    )
    console.log("APPLIED.")
  }
}

main().catch(console.error).finally(() => db.$disconnect())
