/** Loading placeholder for the account directory (never render null while loading). */
export function AccountsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-24 animate-pulse p-4" />
      ))}
    </div>
  )
}
