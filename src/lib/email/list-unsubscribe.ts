/**
 * Parse RFC 2369 List-Unsubscribe / RFC 8058 List-Unsubscribe-Post headers.
 *
 *   List-Unsubscribe: <mailto:leave@list.example?subject=unsub>, <https://example.com/u/abc>
 *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
 */

export interface UnsubscribeOptions {
  /** https URL (http is dropped — never send a one-click POST in cleartext). */
  url: string | null
  mailto: string | null
  /** The sender supports RFC 8058 one-click (server-side POST to `url`). */
  oneClick: boolean
}

const MAX_URI_LENGTH = 2_000

export function parseListUnsubscribe(header: string, postHeader: string): UnsubscribeOptions | null {
  const uris = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim())
  const url = uris.find((u) => /^https:\/\//i.test(u) && u.length <= MAX_URI_LENGTH) ?? null
  const mailto = uris.find((u) => /^mailto:/i.test(u) && u.length <= MAX_URI_LENGTH) ?? null
  if (!url && !mailto) return null
  return {
    url,
    mailto,
    oneClick: !!url && /List-Unsubscribe\s*=\s*One-Click/i.test(postHeader),
  }
}
