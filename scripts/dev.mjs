// Cross-platform dev launcher: prepare DB, clear .next-dev, start Next on :3500.
// Dev builds into .next-dev (not .next) so it never touches the production build.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// 1. Ensure the database schema is ready.
if (spawnSync(process.execPath, ["scripts/db-prepare.mjs"], { stdio: "inherit" }).status !== 0) {
  process.exit(1);
}

// 2. Remove the previous dev build cache.
const DEV_DIST_DIR = ".next-dev";
rmSync(DEV_DIST_DIR, { recursive: true, force: true });

// 3. Start the dev server with a larger heap, on all interfaces, port 3500.
//    One shell string so the `next` shim resolves on Windows and POSIX alike.
const res = spawnSync("npx next dev --hostname 0.0.0.0 --port 3500", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096", NEXT_DIST_DIR: DEV_DIST_DIR },
});
process.exit(res.status ?? 0);
