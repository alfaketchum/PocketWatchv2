import { db } from "@/lib/db"

export const SUBSCRIPTION_TAG = "subscription"

/**
 * Add or remove the "subscription" tag across a merchant's transactions (past +
 * present), keeping transaction tags in sync with the subscription tracker.
 */
export async function syncSubscriptionTag(userId: string, merchant: string, add: boolean): Promise<number> {
  const m = merchant.trim()
  if (!m) return 0
  const txns = await db.financeTransaction.findMany({
    where: {
      userId,
      OR: [
        { merchantName: { equals: m, mode: "insensitive" } },
        { AND: [{ merchantName: null }, { name: { equals: m, mode: "insensitive" } }] },
      ],
    },
    select: { id: true, tags: true },
  })
  const targets = txns.filter((t) => (add ? !t.tags.includes(SUBSCRIPTION_TAG) : t.tags.includes(SUBSCRIPTION_TAG)))
  await Promise.all(
    targets.map((t) =>
      db.financeTransaction.update({
        where: { id: t.id },
        data: { tags: add ? [...t.tags, SUBSCRIPTION_TAG] : t.tags.filter((x) => x !== SUBSCRIPTION_TAG) },
      }),
    ),
  )
  return txns.length
}
