"use client"

import { useQuery } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"
import type { ZipRow } from "@/lib/fire/compare-income"
import type { OewsResult } from "@/lib/fire/bls-oews"

const DAY_MS = 24 * 60 * 60 * 1000

/** ACS income distribution, home value and rent for a zip (looked up on our server). */
export function useZipData(zip: string | null) {
  return useQuery({
    queryKey: financeKeys.fireZip(zip ?? ""),
    queryFn: () => financeFetch<ZipRow & { source: string }>(`/fire/compare/zip?zip=${zip}`),
    enabled: !!zip,
    staleTime: DAY_MS,
    retry: false,
  })
}

/** BLS OEWS wage percentiles for an occupation, nationally and in a state. */
export function useOccupationWages(soc: string | null, state: string | null) {
  const qs = `soc=${soc ?? ""}${state ? `&state=${state}` : ""}`
  return useQuery({
    queryKey: financeKeys.fireOccupation(soc ?? "", state),
    queryFn: () => financeFetch<OewsResult & { source: string }>(`/fire/compare/occupation?${qs}`),
    // Combined Census groups ("15-124X") have no BLS series; the UI falls back to the Census median.
    enabled: !!soc && /^\d{2}-\d{4}$/.test(soc),
    staleTime: DAY_MS,
    retry: false,
  })
}
