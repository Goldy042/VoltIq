/** Inside the operator shell: a quiet placeholder so the sidebar stays put. */
export default function OperatorLoading() {
  return (
    <div className="space-y-4 p-4 lg:p-6" role="status" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded-sm bg-raised" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-md bg-surface" />
    </div>
  );
}
