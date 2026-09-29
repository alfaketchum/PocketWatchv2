/**
 * RFC 8058 one-click unsubscribe: POST "List-Unsubscribe=One-Click" to the
 * sender's https endpoint via the SSRF-guarded client, then record the outcome.
 * Link / mailto unsubscribes happen in the user's browser; the client marks
 * those via PATCH.
 */

import { db } from "@/lib/db"
import { postToPublicHttps } from "@/lib/net/public-https-post"

const ONE_CLICK_BODY = "List-Unsubscribe=One-Click"
const ONE_CLICK_TYPE = "application/x-www-form-urlencoded"

export interface OneClickOutcome {
  id: string
  ok: boolean
  error: string | null
}

export async function unsubscribeOneClick(userId: string, id: string): Promise<OneClickOutcome> {
  const sender = await db.mailSender.findFirst({
    where: { id, userId },
    select: { id: true, oneClick: true, unsubscribeUrl: true },
  })
  if (!sender) return { id, ok: false, error: "Sender not found" }
  if (!sender.oneClick || !sender.unsubscribeUrl) {
    return { id, ok: false, error: "This sender doesn't support one-click unsubscribe" }
  }

  const result = await postToPublicHttps(sender.unsubscribeUrl, ONE_CLICK_BODY, ONE_CLICK_TYPE)
  const error = result.ok ? null : result.error ?? `Sender responded with HTTP ${result.status}`
  await db.mailSender.update({
    where: { id },
    data: result.ok
      ? { status: "unsubscribed", unsubscribedAt: new Date(), unsubscribeMethod: "one_click", lastError: null }
      : { lastError: error?.slice(0, 300) },
  })
  return { id, ok: result.ok, error }
}
