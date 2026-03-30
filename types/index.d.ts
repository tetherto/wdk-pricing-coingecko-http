export class CoingeckoPricingClient extends PricingClient {
    /**
     * @param {Object} [opts={}]
     * @param {string} [opts.baseURL='https://api.coingecko.com/api/v3']
     * @param {Object<string, string>} [opts.coinIds] - Custom symbol-to-CoinGecko-ID map, merged on top of defaults
     */
    constructor(opts?: {
        baseURL?: string;
        coinIds?: {
            [x: string]: string;
        };
    });
    /** @internal */
    MAX_HISTORICAL_ENTRIES: number;
    /** @internal */
    client: import("axios").AxiosInstance;
    /** @internal */
    coinIds: {
        BTC: string;
        ETH: string;
        USDT: string;
        XAUT: string;
        LTC: string;
        XRP: string;
        SOL: string;
        AVAX: string;
        DOGE: string;
        DOT: string;
        MATIC: string;
        LINK: string;
        UNI: string;
        AAVE: string;
        ADA: string;
        NEAR: string;
        EOS: string;
        TRX: string;
        ALGO: string;
        MXNT: string;
        EURT: string;
        CNHT: string;
    };
    _coinId(symbol: any): any;
    /** @internal */
    _cappedToMaxResults(results: any): any;
}
export type PricePair = import("@tetherto/wdk-pricing-provider").PricePair;
export type HistoricalPriceOptions = import("@tetherto/wdk-pricing-provider").HistoricalPriceOptions;
export type HistoricalPriceResult = import("@tetherto/wdk-pricing-provider").HistoricalPriceResult;
export type PriceData = import("@tetherto/wdk-pricing-provider").PriceData;
import { PricingClient } from '@tetherto/wdk-pricing-provider';
