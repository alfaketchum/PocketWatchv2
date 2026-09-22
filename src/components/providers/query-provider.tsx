"use client"

import { ReactNode, useRef } from "react"
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query"

function handleAuthError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("authentication required") &&
    typeof window !== "undefined"
  ) {
    // Redirect to login — only once per page to avoid redirect loops
    const key = "__pw_auth_redirect"
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1")
      window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`
    }
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleAuthError,
    }),
    mutationCache: new MutationCache({
      onError: handleAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Refetch stale data when a component mounts. staleTime (5m) + the
        // per-layout prefetching still avoid redundant fetches within the
        // window; without this, navigating back to a page shows whatever was
        // cached (often empty/partial from an early load) and never refreshes
        // until a hard refresh rebuilds the cache.
        refetchOnMount: true,
        retry: (failureCount, error) => {
          // Don't retry auth errors
          if (error instanceof Error && error.message.toLowerCase().includes("authentication required")) {
            return false
          }
          return failureCount < 1
        },
      },
    },
  })
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<QueryClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = makeQueryClient()
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  )
}
