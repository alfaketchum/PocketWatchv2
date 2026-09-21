// Cross-platform build: optional pre-deploy schema push, then generate + build.
import { spawnSync } from "node:child_process";

// One shell string so npm bin shims (npx/prisma/next) resolve on Windows (.cmd)
// and POSIX alike, without DEP0190 (args + shell).
function run(command) {
  return spawnSync(command, { stdio: "inherit", shell: true });
}

// Optional: push schema to a dedicated migrate URL before building (used by
// some hosts where the runtime DATABASE_URL is pooled/read-only for DDL).
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (migrateUrl) {
  const push = run(`npx prisma db push --accept-data-loss --url ${migrateUrl}`);
  if (push.status !== 0) process.exit(push.status ?? 1);
}

if (run("npx prisma generate").status !== 0) process.exit(1);
process.exit(run("npx next build").status ?? 0);
