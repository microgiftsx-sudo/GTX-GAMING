import SiteLoadingScreen from "@/components/ui/SiteLoadingScreen";

/** Shown during route transitions (Suspense) for locale segment. */
export default function Loading() {
  return (
    <div className="flex min-h-[min(70vh,560px)] w-full flex-1 items-center justify-center py-16">
      <SiteLoadingScreen />
    </div>
  );
}
