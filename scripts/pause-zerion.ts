import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Manually rest Zerion via the provider governor: block all zerion call-gates
// for N minutes so the governor denies permits and balance fetches fall through
// to Alchemy. Self-expiring — the governor clears the block once nextAllowedAt
// passes, so Zerion resumes on its own. `--resume` lifts it immediately.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const RESUME = process.argv.includes("--resume")
const MINUTES = Number(process.argv.find((a) => a.startsWith("--min="))?.split("=")[1]) || 30

async function main() {
  if (RESUME) {
    const r = await db.providerCallGate.updateMany({
      where: { provider: "zerion" },
      data: { nextAllowedAt: null, consecutive429: 0 },
    })
    console.log(`Resumed Zerion — cleared ${r.count} gate(s).`)
    return
  }
  const until = new Date(Date.now() + MINUTES * 60_000)
  const r = await db.providerCallGate.updateMany({
    where: { provider: "zerion" },
    data: { nextAllowedAt: until, consecutive429: 1 },
  })
  console.log(`Paused Zerion: ${r.count} gate(s) blocked until ${until.toLocaleTimeString()} (${MINUTES} min).`)
  console.log(`Alchemy serves balances meanwhile; Zerion auto-resumes at ${until.toLocaleTimeString()}.`)
}

main().catch((e) => console.error("ERR", e)).finally(() => db.$disconnect())
