/** Normalized item from Digiseller «goods in section» (f=2) XML. */
export type PlatiGoodsItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  discount: string;
  isGiftCard: boolean;
  rewardPercent: string;
  sellerId: string;
  sellerName: string;
  rating: string;
  summpay: string;
  salePercent?: string;
  commonPriceUsd?: string;
  commonPriceEur?: string;
};

export type PlatiGoodsListResult = {
  retval: number;
  retdesc: string;
  idSection: string;
  nameSection: string;
  cntGoods: number;
  pages: number;
  page: number;
  order: string;
  items: PlatiGoodsItem[];
};
