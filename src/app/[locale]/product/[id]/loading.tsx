/** Product route: light placeholder while JSON loads (images load in-page after). */
export default function ProductLoading() {
  return (
    <div className="flex min-h-[40vh] w-full items-start justify-center pt-16">
      <div
        className="h-8 w-8 rounded-full border-2 border-white/10 border-t-brand-orange animate-spin"
        aria-busy="true"
        aria-label="Loading"
      />
    </div>
  );
}
