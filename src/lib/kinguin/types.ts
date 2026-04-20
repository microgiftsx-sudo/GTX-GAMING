export interface KinguinImages {
  cover?: { url?: string; thumbnail?: string };
  screenshots?: { url?: string; thumbnail?: string }[];
}

export interface KinguinVideoRef {
  video_id?: string;
}

export interface KinguinProductJson {
  kinguinId: number;
  productId?: string;
  name: string;
  description?: string;
  platform?: string;
  price: number;
  offers?: { price: number; name?: string; merchantName?: string }[];
  offersCount?: number;
  tags?: string[];
  genres?: string[];
  images?: KinguinImages;
  /** YouTube video ids from Kinguin (embed via /embed/{id}). */
  videos?: KinguinVideoRef[];
  regionalLimitations?: string;
  updatedAt?: string;
}

export interface KinguinSearchResponse {
  results: KinguinProductJson[];
  item_count: number;
}
