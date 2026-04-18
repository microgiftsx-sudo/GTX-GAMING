/** Route transition: compact indicator — page shell stays visible; no full-screen image wait. */
export default function Loading() {
  return (
    <div className="flex min-h-[30vh] w-full flex-1 flex-col items-center justify-start pt-16">
      <div
        className="h-8 w-8 rounded-full border-2 border-white/10 border-t-brand-orange animate-spin"
        aria-busy="true"
        aria-label="Loading"
      />
    </div>
  );
}
