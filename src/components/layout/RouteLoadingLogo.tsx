/** Shared route `loading.tsx` placeholder — matches header logo asset. */
export default function RouteLoadingLogo({
  minHeightClass = "min-h-[30vh]",
}: {
  minHeightClass?: string;
}) {
  return (
    <div
      className={`flex w-full flex-1 flex-col items-center justify-start pt-16 ${minHeightClass}`}
      aria-busy="true"
      aria-label="Loading"
    >
      <img
        src="/icons/logo.png"
        alt=""
        width={88}
        height={88}
        className="h-[4.25rem] w-[4.25rem] animate-pulse object-contain opacity-95 md:h-20 md:w-20"
      />
    </div>
  );
}
