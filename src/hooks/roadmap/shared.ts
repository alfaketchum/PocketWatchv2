/**
 * Fetch helper, types and query key factory for the Roadmap hooks.
 */

import { csrfHeaders } from "@/lib/csrf-client"
import type { RoadmapStatus, RoadmapTier } from "@/lib/roadmap/roadmap-seed"

export interface RoadmapItem {
  id: string
  key: string | null
  tier: RoadmapTier
  rank: number
  title: string
  summary: string
  demand: string
  plStatus: string
  ourStatus: string
  effort: string
  status: RoadmapStatus
  notes: string
  updatedAt: string
}

export const roadmapKeys = {
  all: ["roadmap"] as const,
  list: () => [...roadmapKeys.all, "list"] as const,
}

export async function roadmapFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/roadmap${path}`, {
    ...options,
    credentials: "include",
    headers: csrfHeaders({ "Content-Type": "application/json", ...options?.headers }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}
