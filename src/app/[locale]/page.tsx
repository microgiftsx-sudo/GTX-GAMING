import HomeClient from "./home-client";
import { getCachedHeroHomeItems, getCachedHomeTrendingItems } from "@/lib/home-feed";

export default async function HomePage() {
  const [heroItems, trendingItems] = await Promise.all([
    getCachedHeroHomeItems(),
    getCachedHomeTrendingItems(),
  ]);

  return <HomeClient heroItems={heroItems} trendingItems={trendingItems} />;
}
