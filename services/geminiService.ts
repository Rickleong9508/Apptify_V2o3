import { Stock } from "../types";

export interface StockUpdateResult {
  symbol: string;
  price: number;
  currency: string;
}

export interface MarketUpdateResponse {
    updates: StockUpdateResult[];
    exchangeRate: number;
    groundings: string[];
}

export const updateStockPrices = async (stocks: Stock[]): Promise<MarketUpdateResponse> => {
    // AI features disabled
    return {
        updates: [],
        exchangeRate: 4.5,
        groundings: []
    };
};