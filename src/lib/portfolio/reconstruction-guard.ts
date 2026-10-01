// A timed-out caller does not stop the underlying reconstruction. Keep the
// in-flight work visible so the next cron tick cannot start another copy.
const inFlight = new Map<string, Promise<unknown>>()

export function runReconstructionOnce<T>(
  userId: string,
  reconstruct: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(userId)
  if (existing) return existing as Promise<T>

  const work = Promise.resolve().then(reconstruct)
  inFlight.set(userId, work)
  void work.then(
    () => inFlight.delete(userId),
    () => inFlight.delete(userId),
  )
  return work
}
