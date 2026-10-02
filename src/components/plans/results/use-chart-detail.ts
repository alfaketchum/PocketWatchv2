"use client"

import { useCallback, useEffect, useState } from "react"

/** Remembered per browser: whether the chart shows subcategories. */
const DETAIL_KEY = "pw-plan-chart-detail"

function readDetail(): boolean {
  try {
    return localStorage.getItem(DETAIL_KEY) === "1"
  } catch {
    return false
  }
}

/** Whether the chart shows subcategories, remembered per browser (shared by the plan page and Compare). */
export function useChartDetail(): [boolean, (on: boolean) => void] {
  const [detail, setDetailState] = useState(false)
  useEffect(() => setDetailState(readDetail()), [])
  const setDetail = useCallback((on: boolean) => {
    setDetailState(on)
    try {
      localStorage.setItem(DETAIL_KEY, on ? "1" : "0")
    } catch {
      /* private mode: stays for this visit */
    }
  }, [])
  return [detail, setDetail]
}
