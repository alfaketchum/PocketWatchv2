import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { matchMerchantMap } from "@/lib/finance/merchant-map"

// Split the old "Health & Fitness" category into "Healthcare" (medical) and
// "Fitness". Dry-run by default; pass --apply to write.
const APPLY = process.argv.includes("--apply")
const OLD = "Health & Fitness"
const FITNESS_SUBS = new Set(["Gym", "Classes", "Sports", "Equipment", "Supplements", "Yoga", "Fitness"])

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

// Fitness if the merchant/subcategory is clearly fitness; otherwise Healthcare
// (the medical default the old combined category leaned toward).
function resolve(merchantName: string | null, name: string, sub: string | null): { category: string; subcategory: string | null } {
  const mm = matchMerchantMap(merchantName ?? name)
  if (mm && mm.category !== OLD) {
    // Trust curated merchant rules to any category — fixes mislabels living
    // under the old bucket (e.g. Citrini Research → Education/Substack).
    return { category: mm.category, subcategory: mm.subcategory ?? sub }
  }
  if (sub && FITNESS_SUBS.has(sub)) return { category: "Fitness", subcategory: sub }
  return { category: "Healthcare", subcategory: sub }
}

async function main() {
  console.log(`\n=== Split "${OLD}" → Healthcare / Fitness — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`)

  // 1. Transactions
  const txns = await db.financeTransaction.findMany({
    where: { category: OLD },
    select: { id: true, name: true, merchantName: true, subcategory: true },
  })
  console.log(`Transactions on "${OLD}": ${txns.length}`)
  let toHealth = 0
  let toFit = 0
  for (const t of txns) {
    const r = resolve(t.merchantName, t.name, t.subcategory)
    if (r.category === "Fitness") toFit++
    else toHealth++
    const label = (t.merchantName ?? t.name).slice(0, 34).padEnd(34)
    console.log(`  ${label} → ${r.category}${r.subcategory ? ` / ${r.subcategory}` : ""}`)
    if (APPLY) {
      await db.financeTransaction.update({ where: { id: t.id }, data: { category: r.category, subcategory: r.subcategory } })
    }
  }
  console.log(`  → ${toHealth} Healthcare, ${toFit} Fitness\n`)

  // 2. Budgets — a single limit can't be split; move to Healthcare and report.
  const budgets = await db.financeBudget.findMany({ where: { category: OLD }, select: { monthlyLimit: true } })
  console.log(`Budgets on "${OLD}": ${budgets.length}${budgets.length ? " → Healthcare (add a Fitness budget manually if needed)" : ""}`)
  if (APPLY && budgets.length) await db.financeBudget.updateMany({ where: { category: OLD }, data: { category: "Healthcare" } })

  // 3. Category rules — repoint by subcategory.
  const rules = await db.financeCategoryRule.findMany({ where: { category: OLD }, select: { id: true, matchValue: true, subcategory: true } })
  console.log(`Category rules on "${OLD}": ${rules.length}`)
  for (const r of rules) {
    const cat = r.subcategory && FITNESS_SUBS.has(r.subcategory) ? "Fitness" : "Healthcare"
    console.log(`  rule ${r.matchValue} → ${cat}`)
    if (APPLY) await db.financeCategoryRule.update({ where: { id: r.id }, data: { category: cat } })
  }

  // 4. FinanceSubscription (cosmetic category) — same split.
  const subs = await db.financeSubscription.findMany({ where: { category: OLD }, select: { id: true, merchantName: true } })
  console.log(`FinanceSubscription rows on "${OLD}": ${subs.length}`)
  if (APPLY) {
    for (const s of subs) {
      const r = resolve(s.merchantName, s.merchantName, null)
      await db.financeSubscription.update({ where: { id: s.id }, data: { category: r.category } })
    }
  }

  console.log(`\n${APPLY ? "APPLIED." : "DRY RUN complete — re-run with --apply to write."}\n`)
}

main().catch(console.error).finally(() => db.$disconnect())
