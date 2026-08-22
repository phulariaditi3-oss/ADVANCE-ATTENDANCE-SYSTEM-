export default function LoadingSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="skeleton h-4 w-24 mb-3" />
            <div className="skeleton h-8 w-16 mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="card p-6">
        <div className="skeleton h-6 w-48 mb-6" />
        <div className="space-y-3">
          {/* Header */}
          <div className="flex gap-4">
            {[...Array(columns)].map((_, i) => (
              <div key={i} className="skeleton h-4 flex-1" />
            ))}
          </div>
          {/* Rows */}
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex gap-4">
              {[...Array(columns)].map((_, j) => (
                <div key={j} className="skeleton h-4 flex-1" style={{ opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
