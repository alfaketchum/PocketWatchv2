/** The stress test page's tabs, in the order you'd use them: set it up, see the answer, improve it, then the detail. */
export type StressTab = "summary" | "improve" | "outcomes" | "trials" | "setup"

export const STRESS_TABS: { value: StressTab; label: string; icon: string }[] = [
  { value: "setup", label: "Setup", icon: "tune" },
  { value: "summary", label: "Summary", icon: "insights" },
  { value: "improve", label: "Improve", icon: "trending_up" },
  { value: "outcomes", label: "Outcomes", icon: "bar_chart" },
  { value: "trials", label: "Trials", icon: "table_rows" },
]

export const DEFAULT_STRESS_TAB: StressTab = "setup"

/** The tab a ?tab= value points at, Setup for anything else. */
export function stressTabFrom(value: string | null): StressTab {
  return STRESS_TABS.find((t) => t.value === value)?.value ?? DEFAULT_STRESS_TAB
}
