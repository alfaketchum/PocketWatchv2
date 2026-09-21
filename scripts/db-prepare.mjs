// Cross-platform DB prepare: best-effort backup, then generate + migrate/push.
// Mirrors the original POSIX `db:prepare` script but runs on Windows too.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// Pass the whole command as one shell string so npm bin shims (npx/prisma)
// resolve on Windows (.cmd) and POSIX alike, without DEP0190 (args + shell).
function run(command) {
  return spawnSync(command, { stdio: "inherit", shell: true });
}

// 1. Best-effort backup (skipped silently if pg_dump is unavailable).
try {
  const dump = spawnSync("pg_dump pocketwatch", { encoding: "buffer", shell: true });
  if (dump.status === 0 && dump.stdout?.length) {
    mkdirSync("backups", { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
    writeFileSync(`backups/pocketwatch-${stamp}.sql`, dump.stdout);
    console.log("Backup saved to backups/");
  }
} catch {
  // No pg_dump / no local DB — ignore, same as `2>/dev/null` in the original.
}

// 2. Generate the Prisma client.
if (run("npx prisma generate").status !== 0) process.exit(1);

// 3. Apply migrations; fall back to a direct schema push if they don't fit
//    the current database (handles repo migration/schema drift).
const migrate = run("npx prisma migrate deploy");
if (migrate.status !== 0) {
  console.log("migrate deploy failed — falling back to prisma db push");
  const push = run("npx prisma db push --accept-data-loss");
  process.exit(push.status ?? 1);
}
