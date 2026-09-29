"use client"

import { useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { financeFetch, financeKeys } from "./shared"
import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"
import type { FireInputs, FireMode } from "@/lib/fire/fire-types"

interface FireProfileResponse {
  inputs: FireInputs
  saved: boolean
  updatedAt: string | null
}

const SAVE_DEBOUNCE_MS = 700

export function useFireProfile() {
  return useQuery({
    queryKey: financeKeys.fireProfile(),
    queryFn: () => financeFetch<FireProfileResponse>("/fire/profile"),
    staleTime: 5 * 60_000,
  })
}

function useSaveFireProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inputs: FireInputs) =>
      financeFetch<FireProfileResponse>("/fire/profile", { method: "PUT", body: JSON.stringify(inputs) }),
    onError: (err: Error) => {
      toast.error(`Couldn't save FIRE settings: ${err.message}`)
      qc.invalidateQueries({ queryKey: financeKeys.fireProfile() })
    },
  })
}

/**
 * Editable FIRE inputs. Updates apply to the cache immediately (every consumer re-renders)
 * and persist with a short debounce so sliders don't spam the API.
 */
export function useFireInputs() {
  const qc = useQueryClient()
  const profile = useFireProfile()
  const save = useSaveFireProfile()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save.mutate)
  saveRef.current = save.mutate

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const inputs = profile.data?.inputs ?? DEFAULT_FIRE_INPUTS

  const update = useCallback(
    (patch: Partial<FireInputs>) => {
      const current = qc.getQueryData<FireProfileResponse>(financeKeys.fireProfile())
      // Until the saved profile loads, an edit would overwrite it with defaults.
      if (!current) return
      const next: FireInputs = { ...current.inputs, ...patch }
      qc.setQueryData<FireProfileResponse>(financeKeys.fireProfile(), {
        inputs: next,
        saved: true,
        updatedAt: current.updatedAt,
      })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => saveRef.current(next), SAVE_DEBOUNCE_MS)
    },
    [qc],
  )

  return {
    inputs,
    update,
    isLoading: profile.isLoading,
    isSaving: save.isPending,
  }
}

export function useFireMode(): [FireMode, (mode: FireMode) => void] {
  const { inputs, update } = useFireInputs()
  const setMode = useCallback((mode: FireMode) => update({ mode }), [update])
  return [inputs.mode, setMode]
}
