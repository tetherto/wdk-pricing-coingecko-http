// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { PricingClient } from '@tetherto/wdk-pricing-provider'
import axios from 'axios'

/**
 * @typedef {import('@tetherto/wdk-pricing-provider').PricePair} PricePair
 * @typedef {import('@tetherto/wdk-pricing-provider').HistoricalPriceResult} HistoricalPriceResult
 * @typedef {import('@tetherto/wdk-pricing-provider').PriceData} PriceData
 */

/**
 * @typedef {Object} CoingeckoPricingClientOptions
 * @property {string} [baseURL] - CoinGecko API base URL. Use the Pro host
 *   (https://pro-api.coingecko.com/api/v3) together with a Pro key
 *   (default: https://api.coingecko.com/api/v3).
 * @property {Object<string, string>} [coinIds] - Symbol-to-CoinGecko-ID overrides,
 *   merged on top of the built-in defaults.
 * @property {string} [apiKey] - CoinGecko API key. The matching auth header is
 *   selected from the base URL: the Demo header for the public host, the Pro
 *   header for the Pro host.
 */

/**
 * @typedef {Object} HistoricalPriceQuery
 * @property {number} start - Start of the range, Unix timestamp in milliseconds (required).
 * @property {number} end - End of the range, Unix timestamp in milliseconds (required).
 * @property {number} [maxEntries] - When set, evenly downsamples the result to at most
 *   this many points, always keeping the first and last point.
 */

// CoinGecko identifies assets by slug (e.g. "tether-gold" for XAUT) rather than ticker
// symbols, and the slug is not derivable from the ticker. The default map stays small and
// tailored to Tether tokens plus the majors; callers extend or override via opts.coinIds.
const DEFAULT_COIN_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  XAUT: 'tether-gold',
  USAT: 'usa'
}

// Free/Demo tier only exposes the trailing 365 days of historical data; the Pro tier
// reaches back to 2013, so the window is enforced for non-Pro clients only.
// @see https://www.coingecko.com/learn/download-bitcoin-historical-data
const HISTORICAL_DATA_AGE_MS = 365 * 24 * 60 * 60000

const PRO_HOST = 'pro-api.coingecko.com'

const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3'

export class CoingeckoPricingClient extends PricingClient {
  /**
   * Creates a CoinGecko-backed pricing client.
   *
   * @param {CoingeckoPricingClientOptions} [opts] - Client options (default: {}).
   */
  constructor (opts = {}) {
    super()

    const baseURL = opts.baseURL || DEFAULT_BASE_URL

    /** @private */
    this._isPro = baseURL.includes(PRO_HOST)

    const headers = {}
    if (opts.apiKey) {
      // CoinGecko uses different auth headers per tier: x-cg-demo-api-key for the public
      // host and x-cg-pro-api-key for the Pro host.
      headers[this._isPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = opts.apiKey
    }

    /** @private */
    this._client = axios.create({ baseURL, headers })

    /** @private */
    this._coinIds = { ...DEFAULT_COIN_IDS, ...opts.coinIds }
  }

  /** @private */
  _coinId (symbol) {
    const id = this._coinIds[symbol.toUpperCase()]
    if (!id) {
      throw new Error(`Unknown symbol: ${symbol}. Add it to coinIds in the constructor`)
    }
    return id
  }

  /** @private */
  _fetchPrices (list, extraParams = {}) {
    const ids = [...new Set(list.map((p) => this._coinId(p.from)))]
    const currencies = [...new Set(list.map((p) => p.to.toLowerCase()))]

    return this._client.get('/simple/price', {
      params: {
        ids: ids.join(','),
        vs_currencies: currencies.join(','),
        ...extraParams
      }
    })
  }

  /** @private */
  _resample (results, maxEntries) {
    if (results.length <= maxEntries) return results
    if (maxEntries <= 1) return results.slice(0, maxEntries)

    // Even resample preserving the first and last point: index 0 maps to the oldest
    // point and index (maxEntries - 1) maps to the newest, so the count is deterministic.
    const lastIndex = results.length - 1
    const step = lastIndex / (maxEntries - 1)
    return Array.from({ length: maxEntries }, (_, i) => results[Math.round(i * step)])
  }

  /**
   * Fetches the current price for a single asset/currency pair.
   *
   * @param {string} from - Asset ticker symbol (e.g. 'BTC'), resolved to a CoinGecko ID
   *   via the coinIds map; case-insensitive.
   * @param {string} to - Currency code CoinGecko accepts as `vs_currency` (e.g. 'USD');
   *   case-insensitive.
   * @returns {Promise<number|null>} The current price. Resolves to null when CoinGecko
   *   returns no data for the pair (matching the sibling fallback providers).
   * @throws {Error} If `from` has no configured CoinGecko ID.
   * @see https://docs.coingecko.com/reference/simple-price
   */
  async getCurrentPrice (from, to) {
    const id = this._coinId(from)
    const vs = to.toLowerCase()
    const response = await this._client.get('/simple/price', {
      params: { ids: id, vs_currencies: vs }
    })
    return response.data[id]?.[vs] ?? null
  }

  /**
   * Fetches current prices for multiple pairs in a single batched request.
   *
   * @param {PricePair[]} list - Currency pairs to price; CoinGecko IDs are de-duplicated
   *   before the request is sent.
   * @returns {Promise<Array<number|null>>} Prices in the same order as `list`. An entry is
   *   null when CoinGecko returns no data for that pair.
   * @throws {Error} If any pair's `from` has no configured CoinGecko ID.
   * @see https://docs.coingecko.com/reference/simple-price
   */
  async getMultiCurrentPrices (list) {
    const response = await this._fetchPrices(list)
    return list.map(
      (p) => response.data[this._coinId(p.from)]?.[p.to.toLowerCase()] ?? null
    )
  }

  /**
   * Fetches full price data (last price and daily change) for multiple pairs in a single
   * batched request.
   *
   * CoinGecko only returns the 24h change as a percentage, so the absolute `dailyChange`
   * is derived from the last price and that percentage and is therefore an approximation.
   *
   * @param {PricePair[]} list - Currency pairs to price.
   * @returns {Promise<Array<PriceData|null>>} Price data in the same order as `list`. An entry is
   *   null when CoinGecko returns no data for that pair.
   * @throws {Error} If any pair's `from` has no configured CoinGecko ID.
   * @see https://docs.coingecko.com/reference/simple-price
   */
  async getMultiPriceData (list) {
    const response = await this._fetchPrices(list, { include_24hr_change: true })

    return list.map((p) => {
      const vs = p.to.toLowerCase()
      const coin = response.data[this._coinId(p.from)]
      if (!coin || coin[vs] === undefined) return null

      const lastPrice = coin[vs]
      const dailyChangeRelative = coin[`${vs}_24h_change`] / 100

      return {
        lastPrice,
        dailyChange: lastPrice - lastPrice / (1 + dailyChangeRelative),
        dailyChangeRelative
      }
    })
  }

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
  async getHistoricalPrice (from, to, opts) {
    if (!opts?.start || !opts?.end) {
      throw new Error('start and end timestamps are required')
    }

    if (!this._isPro && opts.start < Date.now() - HISTORICAL_DATA_AGE_MS) {
      throw new Error(
        'Start date older than 365 days requires a CoinGecko Pro API key'
      )
    }

    const id = this._coinId(from)
    const vs = to.toLowerCase()

    const response = await this._client.get(`/coins/${id}/market_chart/range`, {
      params: {
        vs_currency: vs,
        from: Math.floor(opts.start / 1000),
        to: Math.floor(opts.end / 1000)
      }
    })

    const results = response.data.prices.map((point) => ({
      price: point[1],
      timestamp: point[0]
    }))

    return opts.maxEntries ? this._resample(results, opts.maxEntries) : results
  }
}
