"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  useDeleteExternalService,
  useExternalServices,
  useSetExternalService,
  useVerifyExternalService,
} from "@/hooks/portfolio/use-services"
import { getServicesList, showVerificationToast } from "@/components/portfolio/settings/settings-utils"
import { CollapsibleSection } from "./collapsible-section"

const SERVICE = "bls"
const REGISTER_URL = "https://data.bls.gov/registrationEngine/"

/** BLS API key for FIRE › Compare occupation wages. Optional: without it, keyless access (25 lookups/day) is used. */
export function FireBlsKeyCard() {
  const { data, isLoading } = useExternalServices()
  const setService = useSetExternalService()
  const verifyService = useVerifyExternalService()
  const deleteService = useDeleteExternalService()
  const [keyInput, setKeyInput] = useState("")

  const bls = useMemo(() => getServicesList(data).find((s) => s.name === SERVICE && s.configured) ?? null, [data])
  const verified = bls?.verified === true
  const failed = bls?.verificationState === "failed"

  const save = () => {
    const key = keyInput.trim()
    if (!key) return
    setService.mutate(
      { name: SERVICE, api_key: key },
      {
        onSuccess: (res) => {
          setKeyInput("")
          if (res.verified) toast.success("BLS key saved and verified")
          else showVerificationToast("BLS key saved.", res)
        },
        onError: (err: Error) => toast.error(`Couldn't save the BLS key: ${err.message}`),
      },
    )
  }

  const status = isLoading
    ? "Checking…"
    : !bls
      ? "No key — using keyless access (25 lookups a day, cached 30 days)"
      : verified
        ? `Key ${bls.api_key} · verified · 500 lookups a day`
        : failed
          ? `Key ${bls.api_key} · verification failed${bls.verifyError ? `: ${bls.verifyError}` : ""}`
          : `Key ${bls.api_key} · not verified yet`

  return (
    <CollapsibleSection
      id="fire-data-sources"
      title="BLS wage data"
      subtitle="Occupation pay percentiles for FIRE › Compare. Optional — a free key raises the daily limit."
      defaultOpen
    >
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "material-symbols-rounded",
              !bls ? "text-foreground-muted" : verified ? "text-success" : failed ? "text-error" : "text-warning",
            )}
            style={{ fontSize: 18 }}
          >
            {!bls ? "radio_button_unchecked" : verified ? "check_circle" : failed ? "error" : "pending"}
          </span>
          <p className="text-sm text-foreground">{status}</p>
        </div>

        {bls ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={verifyService.isPending}
              onClick={() =>
                verifyService.mutate({ name: SERVICE }, {
                  onSuccess: (res) => (res.verified ? toast.success("BLS key verified") : showVerificationToast("BLS key:", res)),
                  onError: (err: Error) => toast.error(err.message),
                })
              }
            >
              {verifyService.isPending ? "Testing…" : "Retest"}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs text-foreground-muted hover:text-error"
              disabled={deleteService.isPending}
              onClick={() =>
                deleteService.mutate({ name: SERVICE }, {
                  onSuccess: () => toast.success("BLS key removed — using keyless access"),
                  onError: (err: Error) => toast.error(err.message),
                })
              }
            >
              Remove key
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 max-w-[560px]">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Paste your BLS registration key"
              autoComplete="off"
              className="flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button type="button" className="btn-primary text-sm" disabled={!keyInput.trim() || setService.isPending} onClick={save}>
              {setService.isPending ? "Saving…" : "Save key"}
            </button>
          </div>
        )}

        <p className="text-[11px] text-foreground-muted">
          Get a free key at{" "}
          <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            data.bls.gov
          </a>
          . Stored encrypted like your other API keys; only used to fetch wage percentiles.
        </p>
      </div>
    </CollapsibleSection>
  )
}
