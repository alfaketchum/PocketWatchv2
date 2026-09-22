/**
 * Shared fetch helper + query-key factory for the account directory module.
 * Mirrors src/hooks/finance/shared.ts and src/hooks/use-trips.ts.
 */

import { csrfHeaders } from "@/lib/csrf-client"

export type AccountStatus = "active" | "dismissed"
export type AccountSignalType =
  | "welcome"
  | "verify"
  | "password_reset"
  | "security_alert"
  | "receipt"

export interface DiscoveredAccount {
  id: string
  serviceName: string
  serviceDomain: string
  category: string | null
  accountEmail: string
  signalTypes: AccountSignalType[]
  confidence: number
  extractedBy: "heuristic" | "llm"
  lastSeenAt: string | null
  status: AccountStatus
}

export interface AccountListResponse {
  accounts: DiscoveredAccount[]
  total: number
  page: number
  limit: number
}

export interface AccountFilters {
  status?: AccountStatus
  category?: string
  service?: string
  email?: string
  page?: number
  limit?: number
}

export interface AccountScanResult {
  scanned: number
  imported: number
  updated: number
  skipped: number
  accounts: { email: string | null; imported: number; updated: number }[]
}

export async function accountsFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/accounts${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers: csrfHeaders({
        "Content-Type": "application/json",
        ...fetchOptions?.headers,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

export const accountKeys = {
  all: ["accounts"] as const,
  list: (filters: AccountFilters) => [...accountKeys.all, "list", filters] as const,
  scanStatus: () => [...accountKeys.all, "scan-status"] as const,
}

/** Build the /api/accounts query string from filters (omitting empty values). */
export function accountsQuery(filters: AccountFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
