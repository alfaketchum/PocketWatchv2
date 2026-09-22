import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { BUSINESS_EXP_TAG } from "@/lib/finance/tags"

// Migrate the removed "Business Expenses" spend category onto the new "Software"
// category (subcategory "Software"), tagging each transaction "business exp" so
// the business-expense signal survives the taxonomy change.
// Dry-run by default; pass --apply to write.
const APPLY = process.argv.includes("--apply")
const DEAD = "Business Expenses"
const CATEGORY = "Software"
const SUBCATEGORY = "Software"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== "${DEAD}" → "${CATEGORY}" + "${BUSINESS_EXP_TAG}" tag — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`)

  // 1. Transactions — repoint category/subcategory and add the business-exp tag.
  const txns = await db.financeTransaction.findMany({
    where: { category: DEAD },
    select: { id: true, name: true, merchantName: true, tags: true },
  })
  console.log(`Transactions on "${DEAD}": ${txns.length}`)
  for (const t of txns) {
    const label = (t.merchantName ?? t.name).slice(0, 34).padEnd(34)
    const tagged = t.tags.includes(BUSINESS_EXP_TAG)
    console.log(`  ${label} → ${CATEGORY} / ${SUBCATEGORY}${tagged ? "" : "  +tag"}`)
    if (APPLY) {
      await db.financeTransaction.update({
        where: { id: t.id },
        data: {
          category: CATEGORY,
          subcategory: SUBCATEGORY,
          tags: tagged ? t.tags : [...t.tags, BUSINESS_EXP_TAG],
        },
      })
    }
  }

  // 2. Budgets — rename to "Software", or delete if a Software budget already exists
  //    (unique on [userId, category]).
  const budgets = await db.financeBudget.findMany({ where: { category: DEAD }, select: { id: true, userId: true } })
  console.log(`\nBudgets on "${DEAD}": ${budgets.length}`)
  if (APPLY) {
    for (const b of budgets) {
      const existing = await db.financeBudget.findUnique({ where: { userId_category: { userId: b.userId, category: CATEGORY } }, select: { id: true } })
      if (existing) await db.financeBudget.delete({ where: { id: b.id } })
      else await db.financeBudget.update({ where: { id: b.id }, data: { category: CATEGORY } })
    }
  }

  // 3. Category rules that output the dead category — repoint to Software.
  const rules = await db.financeCategoryRule.findMany({ where: { category: DEAD }, select: { id: true, matchValue: true } })
  console.log(`Category rules outputting "${DEAD}": ${rules.length}`)
  for (const r of rules) console.log(`  rule: ${r.matchValue}`)
  if (APPLY && rules.length) {
    await db.financeCategoryRule.updateMany({ where: { category: DEAD }, data: { category: CATEGORY, subcategory: SUBCATEGORY } })
  }

  // 4. FinanceSubscription.category is cosmetic — repoint to Software.
  const subs = await db.financeSubscription.findMany({ where: { category: DEAD }, select: { id: true } })
  console.log(`FinanceSubscription rows on "${DEAD}": ${subs.length}`)
  if (APPLY && subs.length) {
    await db.financeSubscription.updateMany({ where: { category: DEAD }, data: { category: CATEGORY } })
  }

  console.log(`\n${APPLY ? "APPLIED." : "DRY RUN complete — re-run with --apply to write."}\n`)
}

main().catch(console.error).finally(() => db.$disconnect())
