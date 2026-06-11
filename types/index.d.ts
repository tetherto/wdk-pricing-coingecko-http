export class CoingeckoPricingClient extends PricingClient {
    /**
     * Creates a CoinGecko-backed pricing client.
     *
     * @param {CoingeckoPricingClientOptions} [opts] - Client options (default: {}).
     */
    constructor(opts?: CoingeckoPricingClientOptions);
    /** @private */
    private _isPro;
    /** @private */
    private _client;
    /** @private */
    private _coinIds;
    /** @private */
    private _coinId;
    /** @private */
    private _fetchPrices;
    /** @private */
    private _resample;
    /**
     * Fetches historical prices for a pair over a time range.
     *
     * @param {string} from - Asset ticker symbol (e.g. 'BTC'), resolved via the coinIds map;
     *   case-insensitive.
     * @param {string} to - Currency code CoinGecko accepts as `vs_currency` (e.g. 'USD');
     *   case-insensitive.
     * @param {HistoricalPriceQuery} opts - Range options. `start` and `end` (Unix ms) are
     *   required; pass `maxEntries` to evenly downsample the result.
     * @returns {Promise<HistoricalPriceResult[]>} Price points, oldest first. Returns every
     *   point CoinGecko provides unless `maxEntries` is set.
     * @throws {Error} If `from` has no configured CoinGecko ID, if `start`/`end` are missing,
     *   or if `start` predates the trailing 365-day window on a non-Pro client.
     * @see https://docs.coingecko.com/reference/coins-id-market-chart-range
     */
    getHistoricalPrice(from: string, to: string, opts?: HistoricalPriceQuery): Promise<HistoricalPriceResult[]>;
}
export type PricePair = import("@tetherto/wdk-pricing-provider").PricePair;
export type HistoricalPriceResult = import("@tetherto/wdk-pricing-provider").HistoricalPriceResult;
export type PriceData = import("@tetherto/wdk-pricing-provider").PriceData;
export type CoingeckoPricingClientOptions = {
    /**
     * - CoinGecko API base URL. Use the Pro host
     * (https://pro-api.coingecko.com/api/v3) together with a Pro key
     * (default: https://api.coingecko.com/api/v3).
     */
    baseURL?: string;
    /**
     * - Symbol-to-CoinGecko-ID overrides,
     * merged on top of the built-in defaults.
     */
    coinIds?: {
        [x: string]: string;
    };
    /**
     * - CoinGecko API key. The matching auth header is
     * selected from the base URL: the Demo header for the public host, the Pro
     * header for the Pro host.
     */
    apiKey?: string;
};
export type HistoricalPriceQuery = {
    /**
     * - Start of the range, Unix timestamp in milliseconds (required).
     */
    start: number;
    /**
     * - End of the range, Unix timestamp in milliseconds (required).
     */
    end: number;
    /**
     * - When set, evenly downsamples the result to at most
     * this many points, always keeping the first and last point.
     */
    maxEntries?: number;
};
import { PricingClient } from '@tetherto/wdk-pricing-provider';
