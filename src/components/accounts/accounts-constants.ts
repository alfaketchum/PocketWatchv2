/**
 * Shared labels/options for the account directory UI.
 */

import type { AccountSignalType } from "@/hooks/accounts"

export const CATEGORY_OPTIONS: readonly string[] = [
  "streaming",
  "finance",
  "shopping",
  "social",
  "developer",
  "productivity",
  "gaming",
  "travel",
  "food",
  "health",
  "utilities",
  "education",
  "other",
]

export const SIGNAL_LABELS: Record<AccountSignalType, string> = {
  welcome: "Welcome",
  verify: "Verified",
  password_reset: "Password reset",
  security_alert: "Security alert",
  receipt: "Receipt",
}

/** Title-case a lowercase category slug for display. */
export function categoryLabel(category: string | null): string | null {
  if (!category) return null
  return category.charAt(0).toUpperCase() + category.slice(1)
}
