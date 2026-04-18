import SiteLoadingScreen from "@/components/ui/SiteLoadingScreen";

export default function ProductLoading() {
  return (
    <div className="flex min-h-[min(75vh,640px)] w-full items-center justify-center py-16">
      <SiteLoadingScreen />
    </div>
  );
}
