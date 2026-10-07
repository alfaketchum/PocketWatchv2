/** The stress test page's tabs, in order: the answer first, then how to improve it, the detail, and the settings. */
export type StressTab = "summary" | "improve" | "outcomes" | "trials" | "setup"

export const STRESS_TABS: { value: StressTab; label: string; icon: string }[] = [
  { value: "summary", label: "Summary", icon: "insights" },
  { value: "improve", label: "Improve", icon: "trending_up" },
  { value: "outcomes", label: "Outcomes", icon: "bar_chart" },
  { value: "trials", label: "Trials", icon: "table_rows" },
  { value: "setup", label: "Setup", icon: "tune" },
]

export const DEFAULT_STRESS_TAB: StressTab = "summary"

/** The tab a ?tab= value points at, the Summary for anything else. */
export function stressTabFrom(value: string | null): StressTab {
  return STRESS_TABS.find((t) => t.value === value)?.value ?? DEFAULT_STRESS_TAB
}
