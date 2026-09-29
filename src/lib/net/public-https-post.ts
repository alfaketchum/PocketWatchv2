/**
 * POST to a URL that came from untrusted input (e.g. an email header) without
 * letting it reach private infrastructure (SSRF guard).
 *
 * - https only, default port, no credentials in the URL.
 * - The address is validated inside the socket's DNS lookup, so the check and
 *   the connection use the same resolved IP (no DNS-rebinding window); IP-literal
 *   hosts (which skip the lookup) are checked up front.
 * - Loopback, private, link-local, CGNAT, multicast and reserved ranges (v4
 *   and v6, incl. IPv4-mapped) are refused. Redirects are not followed.
 */

import https from "node:https"
import dns from "node:dns"
import net from "node:net"

const TIMEOUT_MS = 10_000

const BLOCKED_V4: ReadonlyArray<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
]

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function isBlockedV4(ip: string): boolean {
  const addr = v4ToInt(ip)
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (addr & mask) === (v4ToInt(base) & mask)
  })
}

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return !isBlockedV4(ip)
  if (!net.isIPv6(ip)) return false
  const lower = ip.toLowerCase()
  // IPv4-mapped, dotted (::ffff:10.0.0.1) or hex as URL parsing emits it (::ffff:a00:1).
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return !isBlockedV4(dotted[1])
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const n = (parseInt(hex[1], 16) << 16) + parseInt(hex[2], 16)
    return !isBlockedV4([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."))
  }
  // Any other address with leading zero groups (::, ::1, IPv4-compatible ::a.b.c.d)
  // or the NAT64 prefix can embed an internal IPv4 — refuse.
  if (lower.startsWith("::") || lower.startsWith("64:ff9b:")) return false
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast, 2001:db8::/32 docs
  return !/^(f[cd]|fe[89ab]|ff|2001:0?db8:)/.test(lower)
}

const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0)
    const list = addresses as dns.LookupAddress[]
    const blocked = list.find((a) => !isPublicAddress(a.address))
    if (blocked || list.length === 0) {
      return callback(new Error(`Refusing non-public address for ${hostname}`), "", 0)
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

export interface PostResult {
  ok: boolean
  status: number | null
  error: string | null
}

export function postToPublicHttps(rawUrl: string, body: string, contentType: string): Promise<PostResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return Promise.resolve({ ok: false, status: null, error: "Invalid URL" })
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    return Promise.resolve({ ok: false, status: null, error: "Only plain https URLs are allowed" })
  }
  // IP-literal hosts never reach the lookup hook, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (net.isIP(host) && !isPublicAddress(host)) {
    return Promise.resolve({ ok: false, status: null, error: `Refusing non-public address ${host}` })
  }

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: "POST",
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { "Content-Type": contentType, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        res.resume()
        const status = res.statusCode ?? 0
        // 2xx = done; 3xx = the endpoint accepted the POST and points elsewhere (not followed).
        resolve({ ok: status >= 200 && status < 400, status, error: null })
      },
    )
    req.on("timeout", () => req.destroy(new Error("Timed out")))
    req.on("error", (err) => resolve({ ok: false, status: null, error: err.message }))
    req.end(body)
  })
}
