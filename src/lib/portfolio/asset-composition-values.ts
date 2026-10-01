/** Snapshot days use their per-token values; today always uses current balances. */
export function assetValueForDay(
  day: string,
  todayKey: string,
  symbol: string,
  today: Map<string, number>,
  snapshot: Record<string, number> | undefined,
  historyValue: number,
): number {
  if (day === todayKey) return today.get(symbol) ?? 0
  if (snapshot) return snapshot[symbol] ?? 0
  return historyValue
}
