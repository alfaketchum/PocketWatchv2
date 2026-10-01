import { CADENCE_LABELS, WATCHLIST, type WatchCadence } from "@/lib/methodology/update-watchlist"
import type { MethodBlock, MethodSection } from "./methodology-types"

const ORDER: WatchCadence[] = ["yearly", "legislation", "automatic"]

function table(cadence: WatchCadence): MethodBlock[] {
  const items = WATCHLIST.filter((i) => i.cadence === cadence)
  return [
    { kind: "text", text: `**${CADENCE_LABELS[cadence]}** (${items.length})` },
    { kind: "table", head: ["What", "In use now", "When it changes", "Source", "File"], rows: items.map((i) => [i.what, i.current, i.when, i.source, i.file]) },
  ]
}

/** The figures and rules that go stale, and what to watch for each (shared with a future monitoring agent). */
export const WATCH_SECTION: MethodSection = {
  id: "keeping-current",
  title: "Keeping it current",
  icon: "update",
  summary: "Every figure that changes yearly or with new laws, where it comes from, and where it lives.",
  blocks: [
    {
      kind: "text",
      text: "Tax law, Social Security figures and price data change on a schedule (most each October–November) or when Congress or a state legislature acts. This list is the checklist: each item names its source to watch and the file to update. It's kept as structured data so a monitoring agent can check the sources and flag what's out of date.",
    },
    ...ORDER.flatMap(table),
  ],
}
