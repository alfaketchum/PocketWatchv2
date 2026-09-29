export default function FireLoading() {
  return (
    <div className="space-y-6">
      <div className="h-[188px] animate-shimmer rounded-2xl" />
      <div className="h-[220px] animate-shimmer rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[150px] animate-shimmer rounded-xl" />
        ))}
      </div>
      <div className="h-[320px] animate-shimmer rounded-2xl" />
    </div>
  )
}
