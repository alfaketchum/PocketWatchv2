/**
 * GET /api/integrations/gmail/callback
 *
 * OAuth 2.0 redirect target. Google sends ?code & ?state (or ?error).
 * - Rejects on ?error= (sanitized before reflection).
 * - CSRF + user binding: looks up the server-side PkceFlow by state and CONSUMES
 *   it (delete-on-read = single-use). The flow carries the userId, so we do NOT
 *   rely on the session cookie (which is sameSite=strict and absent here).
 * - Exchanges the code using the flow's PKCE verifier + the client_secret.
 * - Stores tokens ENCRYPTED via persistGmailTokensForService, keyed by account.
 * - 302s back to /accounts?gmail=<status> on every outcome (this is a browser
 *   navigation, so a JSON error body would strand the user on a raw error page).
 *
 * SECURITY: tokens/codes/verifiers never appear in the redirect URL or logs.
 */

import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  GMAIL_REDIRECT_URI,
  exchangeCode,
  fetchGmailAccountEmail,
  requireGmailClientConfig,
} from "@/lib/integrations/gmail-oauth"
import {
  gmailServiceForEmail,
  persistGmailTokensForService,
} from "@/lib/integrations/gmail-client"

const OAUTH_ERROR_RE = /^[a-z_]{1,40}$/
const RETURN_PATH = "/accounts"

type GmailConnectStatus = "connected" | "denied" | "expired" | "error"

function redirectWithStatus(status: GmailConnectStatus) {
  // Resolve against the public redirect URI, not req.nextUrl.origin: behind the
  // HTTPS proxy the request origin is the internal localhost:<port>.
  const url = new URL(RETURN_PATH, GMAIL_REDIRECT_URI)
  url.searchParams.set("gmail", status)
  return NextResponse.redirect(url, { status: 302 })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const oauthError = params.get("error")
  if (oauthError) {
    const safe = OAUTH_ERROR_RE.test(oauthError) ? oauthError : "authorization_failed"
    console.warn("[API_ERROR] G2201: Gmail authorization denied", { reason: safe })
    return redirectWithStatus("denied")
  }

  const code = params.get("code")
  const state = params.get("state")
  if (!code || !state) {
    console.warn("[API_ERROR] G2202: Missing authorization code or state")
    return redirectWithStatus("error")
  }

  // Look up + consume the single-use server-side flow (CSRF + user binding).
  const flow = await db.pkceFlow.findUnique({ where: { state } })
  if (flow) await db.pkceFlow.delete({ where: { state } }).catch(() => {})
  if (!flow || flow.provider !== "gmail" || flow.expiresAt < new Date()) {
    console.warn("[API_ERROR] G2203: Invalid or expired OAuth state (CSRF check failed)")
    return redirectWithStatus("expired")
  }

  try {
    const config = requireGmailClientConfig()
    const token = await exchangeCode({
      code,
      codeVerifier: flow.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: GMAIL_REDIRECT_URI,
    })

    // Identify which Google account this is so we can store it per-account.
    // The email MUST resolve — keying a multi-account credential by it is the
    // whole point. If the profile lookup fails (transient), abort the connect
    // rather than write into the shared legacy slot and risk clobbering a
    // different account's tokens; the user can simply retry.
    const email = await fetchGmailAccountEmail(token.access_token)
    if (!email) {
      console.warn("[API_ERROR] G2205: Could not resolve Gmail account email")
      return redirectWithStatus("error")
    }
    const service = gmailServiceForEmail(email)

    await persistGmailTokensForService(flow.userId, service, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt:
        typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : 0,
    })

    return redirectWithStatus("connected")
  } catch (err) {
    console.error("[API_ERROR] G2204: Failed to complete Gmail authorization", {
      message: err instanceof Error ? err.message : String(err),
    })
    return redirectWithStatus("error")
  }
}
