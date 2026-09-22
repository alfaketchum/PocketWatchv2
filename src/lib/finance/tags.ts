/**
 * Transaction tag constants — client-safe (no DB imports), shared by the tag
 * pop-out chip picker, the tag display chips, and the server-side
 * subscription-tag sync.
 *
 * Tags are stored lowercased on `FinanceTransaction.tags`.
 */

export const SUBSCRIPTION_TAG = "subscription"
export const BUSINESS_EXP_TAG = "business exp"
export const CARD_PAYMENT_TAG = "card payments"

export interface TagMeta {
  /** Display label. */
  label: string
  /** Material Symbols icon name. */
  icon: string
}

export interface SuggestedTag extends TagMeta {
  /** Stored value (lowercase). */
  value: string
}

/**
 * Predefined tags offered as toggle chips in the tag pop-out — freeform manual
 * labels with no backing record.
 */
export const SUGGESTED_TAGS: SuggestedTag[] = [
  { value: CARD_PAYMENT_TAG, label: "Card payments", icon: "credit_card" },
  { value: BUSINESS_EXP_TAG, label: "Business exp", icon: "business_center" },
]

/**
 * Tags owned by a dedicated control rather than the tag editor. They render as
 * read-only display chips and are toggled elsewhere (e.g. "subscription" is
 * owned by the Mark-as-subscription action, which keeps the tracker in sync).
 */
export const MANAGED_TAGS: Record<string, TagMeta> = {
  [SUBSCRIPTION_TAG]: { label: "Subscription", icon: "autorenew" },
}

const SUGGESTED_BY_VALUE = new Map(SUGGESTED_TAGS.map((t) => [t.value, t]))

/** True when a tag is one of the predefined toggle suggestions. */
export function isSuggestedTag(tag: string): boolean {
  return SUGGESTED_BY_VALUE.has(tag)
}

/** True when a tag is owned by a dedicated control (not freely editable). */
export function isManagedTag(tag: string): boolean {
  return tag in MANAGED_TAGS
}

/** Display label + icon for any tag value (known → nice label, else the raw value). */
export function getTagMeta(tag: string): TagMeta {
  return SUGGESTED_BY_VALUE.get(tag) ?? MANAGED_TAGS[tag] ?? { label: tag, icon: "sell" }
}
