/**
 * Shared fetch helper and query key factory for the Plans React Query hooks.
 */

import { csrfHeaders } from "@/lib/csrf-client"
import type { PlanDocument, PlanSummary } from "@/lib/plans/plan-types"

/** Error carrying the HTTP status, so callers can react to conflicts. */
export class PlansFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function plansFetch<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/plans${path}`, {
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
      throw new PlansFetchError(body.error ?? `Request failed: ${res.status}`, res.status)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

export const plansKeys = {
  all: ["plans"] as const,
  list: () => [...plansKeys.all, "list"] as const,
  detail: (id: string) => [...plansKeys.all, "detail", id] as const,
  importPreview: () => [...plansKeys.all, "import-preview"] as const,
  tradingActivity: () => [...plansKeys.all, "trading-activity"] as const,
}

export interface PlanMeta {
  id: string
  name: string
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanListItem extends PlanMeta {
  summary: PlanSummary | null
}

export interface PlanDetail extends PlanMeta {
  document: PlanDocument
}
