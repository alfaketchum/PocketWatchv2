import "dotenv/config"
import { db } from "@/lib/db"
import { recordCheckIn, type CheckInMonth } from "@/lib/plans/check-in/record-check-in"

// Records plan check-ins for past months that have none, with the planned side estimated from the primary plan
// as it is today (marked "backfill"); months already recorded only get their actuals refreshed.
// Dry-run by default; pass --apply to write. --months=N (default 12).
const APPLY = process.argv.includes("--apply")
const MONTHS = Number(process.argv.find((a) => a.startsWith("--months="))?.split("=")[1] ?? 12)

function pastMonths(count: number, now: Date): CheckInMonth[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - count + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
}

async function main() {
  const plans = await db.plan.findMany({ where: { isPrimary: true }, select: { userId: true, name: true }, take: 1000 })
  const months = pastMonths(MONTHS, new Date())
  for (const { userId, name } of plans) {
    console.log(`${userId} (${name}): ${months.length} months`)
    if (!APPLY) continue
    for (const m of months) {
      const status = await recordCheckIn(userId, m, "backfill")
      console.log(`  ${m.year}-${String(m.month).padStart(2, "0")}: ${status}`)
    }
  }
  if (!APPLY) console.log("Dry run. Pass --apply to write.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
