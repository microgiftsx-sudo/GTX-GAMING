import { HERO_CAROUSEL_MAX } from "@/lib/hero-products";
import { TRENDING_HOME_MAX } from "@/lib/trending-products";
import HomeFeedAdminClient from "./HomeFeedAdminClient";

export default function HomeFeedAdminPage() {
  return (
    <HomeFeedAdminClient
      maxHero={HERO_CAROUSEL_MAX}
      maxTrending={TRENDING_HOME_MAX}
    />
  );
}
