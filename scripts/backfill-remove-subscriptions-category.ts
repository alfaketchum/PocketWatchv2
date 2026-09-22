import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { categorizeTransaction } from "@/lib/finance/categorize"
import { matchMerchantMap } from "@/lib/finance/merchant-map"

// Migrate transactions/budgets/rules/subscriptions off the removed
// "Subscriptions" spend category. Dry-run by default; pass --apply to write.
const APPLY = process.argv.includes("--apply")
const DEAD = "Subscriptions"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== Remove "${DEAD}" category — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`)

  // 1. Transactions — re-run through the categorize engine for a real category.
  const txns = await db.financeTransaction.findMany({
    where: { category: DEAD },
    select: {
      id: true, name: true, merchantName: true, amount: true,
      plaidCategory: true, plaidCategoryPrimary: true,
      account: { select: { type: true, subtype: true } },
    },
  })
  // Only auto-apply high-trust sources. Plaid is excluded: it mis-categorizes
  // SaaS/newsletter merchants (e.g. Postiz→Clothing), so those go to review.
  const TRUSTED = new Set(["hard_rule", "rule", "merchant_map"])
  console.log(`Transactions categorized "${DEAD}": ${txns.length}`)
  let recat = 0
  let review = 0
  for (const t of txns) {
    // Merchant-map first (curated, correct) — the live engine prioritizes Plaid
    // over merchant-map, but Plaid is unreliable for these merchants.
    const mm = matchMerchantMap(t.merchantName ?? t.name)
    let newCat: string
    let newSub: string | null
    let matched: boolean
    let source: string
    if (mm && mm.category !== DEAD) {
      newCat = mm.category
      newSub = mm.subcategory ?? null
      matched = true
      source = "merchant_map"
    } else {
      const res = categorizeTransaction({
        merchantName: t.merchantName ?? "",
        rawName: t.name,
        plaidCategory: t.plaidCategory,
        plaidCategoryPrimary: t.plaidCategoryPrimary,
        amount: t.amount,
        accountType: t.account?.type,
        accountSubtype: t.account?.subtype ?? null,
      })
      matched = !!res.category && res.category !== "Uncategorized" && res.category !== DEAD && TRUSTED.has(res.source)
      newCat = matched ? res.category : "Uncategorized"
      newSub = matched ? (res.subcategory ?? null) : null
      source = res.source
    }
    const label = (t.merchantName ?? t.name).slice(0, 34).padEnd(34)
    console.log(`  ${label} → ${newCat}${newSub ? ` / ${newSub}` : ""}  [${source}]${matched ? "" : "   (needs review)"}`)
    if (matched) recat++
    else review++
    if (APPLY) {
      await db.financeTransaction.update({
        where: { id: t.id },
        data: { category: newCat, subcategory: newSub, ...(matched ? {} : { needsReview: true }) },
      })
    }
  }
  console.log(`  → ${recat} auto-recategorized, ${review} to Uncategorized + needs-review\n`)

  // 2. Budgets — orphaned once the category is gone; delete.
  const budgets = await db.financeBudget.findMany({ where: { category: DEAD }, select: { id: true, monthlyLimit: true } })
  console.log(`Budgets on "${DEAD}": ${budgets.length}${budgets.length ? " (delete)" : ""}`)
  if (APPLY && budgets.length) await db.financeBudget.deleteMany({ where: { category: DEAD } })

  // 3. Category rules that output the dead category — delete so they can't re-add it.
  const rules = await db.financeCategoryRule.findMany({ where: { category: DEAD }, select: { matchValue: true } })
  console.log(`Category rules outputting "${DEAD}": ${rules.length}${rules.length ? " (delete)" : ""}`)
  for (const r of rules) console.log(`  rule: ${r.matchValue}`)
  if (APPLY && rules.length) await db.financeCategoryRule.deleteMany({ where: { category: DEAD } })

  // 4. FinanceSubscription.category is cosmetic (fallback icon color). Repoint to
  //    the last charge's real category where derivable, else clear.
  const subs = await db.financeSubscription.findMany({ where: { category: DEAD }, select: { id: true, lastTransactionId: true } })
  console.log(`FinanceSubscription rows on "${DEAD}": ${subs.length}${subs.length ? " (repoint/clear)" : ""}`)
  if (APPLY) {
    for (const s of subs) {
      let newCat: string | null = null
      if (s.lastTransactionId) {
        const lt = await db.financeTransaction.findUnique({ where: { id: s.lastTransactionId }, select: { category: true } })
        newCat = lt?.category && lt.category !== DEAD ? lt.category : null
      }
      await db.financeSubscription.update({ where: { id: s.id }, data: { category: newCat } })
    }
  }

  console.log(`\n${APPLY ? "APPLIED." : "DRY RUN complete — re-run with --apply to write."}\n`)
}

main().catch(console.error).finally(() => db.$disconnect())
