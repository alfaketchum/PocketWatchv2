"use client"

import { useCallback, useState, useEffect } from "react"
import {
  detectGooner,
  calcSavingsFound,
  type ShareableStats,
} from "@/lib/share-stats"
import { renderReceiptImage, downloadImage } from "@/lib/share-receipt-image"
import { APP_NAME } from "@/lib/brand"

// ─── Data extraction ────────────────────────────────────────────────

function extractShareableStats(deep: any, cardStrategy: any, accountCount: number, activeSubCount?: number): ShareableStats {
  const topMerchant = deep?.frequentMerchants?.[0]

  const gooner = detectGooner(
    deep?.frequentMerchants ?? [],
    deep?.topCategories ?? [],
    deep?.largestPurchases ?? [],
  )

  const savingsFound = calcSavingsFound(
    deep?.subscriptionSummary,
    deep?.budgetHealth,
    cardStrategy?.gapAmount ?? 0,
  )

  const biggestPurchase = deep?.largestPurchases?.[0]?.amount ?? 0
  const score = deep?.healthScore?.score ?? 0

  return {
    g: deep?.healthScore?.grade ?? "?",
    s: Math.round(score * 100) / 100,
    br: Math.round(deep?.spendingVelocity?.dailyAvg ?? 0),
    bp: Math.round(biggestPurchase),
    sc: activeSubCount ?? deep?.subscriptionSummary?.activeCount ?? 0,
    gn: gooner,
    tm: topMerchant?.name ?? "",
    tc: topMerchant?.count ?? 0,
    sv: savingsFound,
    ac: accountCount,
  }
}

function buildViralTweet(): string {
  return `Just pulled my Flex Card on PocketWatch. Open source, private, and self-hosted.

Get yours: https://github.com/viperrcrypto/pocketwatch

Built by @viperr & @0xXinu`
}

// ─── Preview Modal ──────────────────────────────────────────────────

interface FlexPreviewProps {
  imageUrl: string
  imageBlob: Blob
  tweetText: string
  onClose: () => void
}

function FlexPreview({ imageUrl, imageBlob, tweetText, onClose }: FlexPreviewProps) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const handleSave = () => {
    downloadImage(imageBlob)
    setSaved(true)
  }

  const handlePost = () => {
    // Auto-save the image if they haven't already
    if (!saved) downloadImage(imageBlob)
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(tweetText)}`,
      "_blank",
      "noopener,noreferrer",
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 cursor-default"
        onClick={onClose}
        aria-label="Close preview"
      />

      <div className="relative bg-card border border-card-border rounded-2xl shadow-2xl w-[90vw] max-w-[800px] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors z-10"
          aria-label="Close"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
        </button>

        <div className="p-4 pb-0">
          <img
            src={imageUrl}
            alt={`Your ${APP_NAME} Flex Card`}
            className="w-full rounded-xl border border-card-border"
          />
        </div>

        <div className="p-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors border border-card-border text-foreground hover:bg-background-secondary"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              {saved ? "check_circle" : "download"}
            </span>
            {saved ? "Saved" : "Save Image"}
          </button>

          <button
            onClick={handlePost}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors bg-foreground text-background hover:opacity-90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X
          </button>
        </div>

        <p className="px-4 pb-3 text-[10px] text-foreground-muted text-center">
          Image saves automatically — attach it to your post on X
        </p>
      </div>
    </div>
  )
}

// ─── Flex Button ────────────────────────────────────────────────────

export function FlexButton({ deep }: { deep: any }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [preview, setPreview] = useState<{
    imageUrl: string
    imageBlob: Blob
    tweetText: string
  } | null>(null)

  const handleFlex = useCallback(async () => {
    if (!deep || isGenerating) return
    setIsGenerating(true)
    try {
      // Fetch all data fresh for accuracy
      const [freshDeep, cardStrategy, accounts, subs] = await Promise.all([
        fetch("/api/finance/insights/deep")
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("/api/finance/cards/strategy")
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("/api/finance/accounts")
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        fetch("/api/finance/subscriptions")
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
      ])

      // Count total connected accounts across all institutions
      const accountCount = Array.isArray(accounts)
        ? accounts.reduce((sum: number, inst: any) => sum + (inst.accounts?.length ?? 0), 0)
        : 0

      // Count active subscriptions from direct API (more reliable than deep insights)
      const activeSubCount = Array.isArray(subs?.subscriptions)
        ? subs.subscriptions.filter((s: any) => !s.cancelled).length
        : 0

      const stats = extractShareableStats(freshDeep ?? deep, cardStrategy, accountCount, activeSubCount)
      const blob = await renderReceiptImage(stats)
      const imageUrl = URL.createObjectURL(blob)
      const tweetText = buildViralTweet()
      setPreview({ imageUrl, imageBlob: blob, tweetText })
    } catch (err) {
      console.error("[flex] Failed to generate receipt:", err)
    } finally {
      setIsGenerating(false)
    }
  }, [deep, isGenerating])

  const closePreview = useCallback(() => {
    if (preview?.imageUrl) URL.revokeObjectURL(preview.imageUrl)
    setPreview(null)
  }, [preview])

  return (
    <>
      <button
        onClick={handleFlex}
        disabled={isGenerating}
        className="flex-btn flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {isGenerating ? (
          <span className="material-symbols-rounded animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
        ) : (
          <span style={{ fontSize: 13, lineHeight: 1 }}>&#x26A1;</span>
        )}
        Flex
      </button>

      {preview && (
        <FlexPreview
          imageUrl={preview.imageUrl}
          imageBlob={preview.imageBlob}
          tweetText={preview.tweetText}
          onClose={closePreview}
        />
      )}
    </>
  )
}
