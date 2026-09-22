/**
 * Shared display constants for subscription surfaces (card + table views).
 */

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  yearly: "Yearly",
}

export const FREQUENCY_COLORS: Record<string, string> = {
  weekly: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  biweekly: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  monthly: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  quarterly: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  semi_annual: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
  yearly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
}

export const DETECTION_LABELS: Record<string, { text: string; color: string }> = {
  verified: { text: "Verified", color: "text-success" },
  auto: { text: "Auto-detected", color: "text-foreground-muted" },
  manual: { text: "Marked by you", color: "text-primary" },
}

export const FREQUENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "yearly", label: "Yearly" },
]

export const STATUS_STYLES: Record<string, string> = {
  suggested: "badge-neutral",
  active: "badge-success",
  paused: "badge-warning",
  cancelled: "badge-error",
  flagged: "badge-warning",
  dismissed: "badge-neutral",
}
