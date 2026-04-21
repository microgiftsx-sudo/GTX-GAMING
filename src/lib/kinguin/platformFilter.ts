/**
 * Kinguin `GET /v1/products?platform=` expects comma-separated **API platform names**
 * (same strings as each product's `platform` field), e.g. `Steam`, `PlayStation 4`.
 * The storefront sidebar uses compact slugs (`steam`, `psn`, …); map those here.
 * Multiple values are OR'd by the API.
 */
const SIDEBAR_SLUGS = ['steam', 'psn', 'xbox', 'pc'] as const;
type SidebarSlug = (typeof SIDEBAR_SLUGS)[number];

const KINGUIN_NAMES_BY_SLUG: Record<SidebarSlug, readonly string[]> = {
  steam: ['Steam'],
  psn: ['PlayStation 3', 'PlayStation 4', 'PlayStation 5'],
  xbox: ['Xbox 360', 'Xbox One', 'Xbox Series X|S'],
  pc: [
    'Other',
    'Android',
    'EA App',
    'Ubisoft',
    'Nintendo',
    'Epic Games',
    'MS Store (PC)',
    'Battle.net',
    'GOG.com',
    'Nintendo Switch',
    'Nintendo Switch 2',
    'Rockstar Games',
    'NCSoft',
    'Meta Quest',
    'Meta Quest 2',
    'Meta Quest Pro',
    'PC',
  ],
};

function isSidebarSlug(s: string): s is SidebarSlug {
  return (SIDEBAR_SLUGS as readonly string[]).includes(s);
}

/**
 * @returns Comma-separated Kinguin `platform` query value, or `undefined` when the
 *   selection is empty or equivalent to “all platforms” (all four sidebar buckets).
 */
export function kinguinPlatformQueryFromStoreSlugs(platformSlugs: string[]): string | undefined {
  const selected = new Set<SidebarSlug>();
  for (const raw of platformSlugs) {
    const s = raw.trim().toLowerCase();
    if (isSidebarSlug(s)) selected.add(s);
  }
  if (selected.size === 0) return undefined;
  if (selected.size === SIDEBAR_SLUGS.length) return undefined;

  const apiNames = new Set<string>();
  for (const slug of selected) {
    for (const name of KINGUIN_NAMES_BY_SLUG[slug]) {
      apiNames.add(name);
    }
  }
  return [...apiNames].join(',');
}
