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
 * @typedef {import('@tetherto/wdk-pricing-provider').HistoricalPriceOptions} HistoricalPriceOptions
 * @typedef {import('@tetherto/wdk-pricing-provider').HistoricalPriceResult} HistoricalPriceResult
 * @typedef {import('@tetherto/wdk-pricing-provider').PriceData} PriceData
 */

// CoinGecko identifies assets by slug (e.g. "tether-gold" for XAUT, "avalanche-2" for AVAX)
// rather than ticker symbols. These slugs are not derivable from the ticker, so we need
// an explicit map. Callers can extend or override via the constructor's coinIds option.

const DEFAULT_COIN_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  XAUT: 'tether-gold',
  LTC: 'litecoin',
  XRP: 'ripple',
  SOL: 'solana',
  AVAX: 'avalanche-2',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ADA: 'cardano',
  NEAR: 'near',
  EOS: 'eos',
  TRX: 'tron',
  ALGO: 'algorand',
  MXNT: 'mexican-peso-tether',
  EURT: 'tether-eurt',
  CNHT: 'cny-tether'
}

export class CoingeckoPricingClient extends PricingClient {
  /** @internal */
  MAX_HISTORICAL_ENTRIES = 100

  /**
   * @param {Object} [opts={}]
   * @param {string} [opts.baseURL='https://api.coingecko.com/api/v3']
   * @param {Object<string, string>} [opts.coinIds] - Custom symbol-to-CoinGecko-ID map, merged on top of defaults
   * @param {string} [opts.apiKey] - CoinGecko API key for higher rate limits (free or pro tier)
   */
  constructor (opts = {}) {
    super()

    const headers = {}
    if (opts.apiKey) {
      // CoinGecko uses different auth headers per tier: x-cg-demo-api-key for the free
      // tier and x-cg-pro-api-key for paid. The pro tier uses a separate base URL.
      const isPro = opts.baseURL && opts.baseURL.includes('pro-api.coingecko.com')
      headers[isPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = opts.apiKey
    }

    /** @internal */
    this.client = axios.create({
      baseURL: opts.baseURL || 'https://api.coingecko.com/api/v3',
      headers
    })
    /** @internal */
    this.coinIds = { ...DEFAULT_COIN_IDS, ...opts.coinIds }
  }

  _coinId (symbol) {
    const id = this.coinIds[symbol.toUpperCase()]
    if (!id) throw new Error(`Unknown symbol: ${symbol}`)
    return id
  }

  /**
   * @param {string} from
   * @param {string} to
   * @returns {Promise<number>}
   */
  async getCurrentPrice (from, to) {
    const id = this._coinId(from)
    const vs = to.toLowerCase()
    const response = await this.client.get('/simple/price', {
      params: { ids: id, vs_currencies: vs }
    })
    return response.data[id][vs]
  }

  _fetchPrices (list, extraParams = {}) {
    const ids = [...new Set(list.map((p) => this._coinId(p.from)))]
    const currencies = [...new Set(list.map((p) => p.to.toLowerCase()))]

    return this.client.get('/simple/price', {
      params: {
        ids: ids.join(','),
        vs_currencies: currencies.join(','),
        ...extraParams
      }
    })
  }

  /**
   * @param {PricePair[]} list
   * @returns {Promise<number[]>}
   */
  async getMultiCurrentPrices (list) {
    const response = await this._fetchPrices(list)
    return list.map((p) => response.data[this._coinId(p.from)][p.to.toLowerCase()])
  }

  /**
   * @param {PricePair[]} list
   * @returns {Promise<PriceData[]>}
   */
  async getMultiPriceData (list) {
    const response = await this._fetchPrices(list, { include_24hr_change: true })

    return list.map((p) => {
      const vs = p.to.toLowerCase()
      const coin = response.data[this._coinId(p.from)]
      const lastPrice = coin[vs]
      const pctChange = coin[`${vs}_24h_change`]
      const dailyChangeRelative = pctChange / 100

      return {
        lastPrice,
        dailyChange: lastPrice - (lastPrice / (1 + dailyChangeRelative)),
        dailyChangeRelative
      }
    })
  }

  /**
   * @param {string} from
   * @param {string} to
   * @param {HistoricalPriceOptions} [opts={}]
   * @returns {Promise<HistoricalPriceResult[]>}
   */
  async getHistoricalPrice (from, to, opts = {}) {
    if (!opts.start || !opts.end) {
      throw new Error('start and end timestamps are required')
    }

    const id = this._coinId(from)
    const vs = to.toLowerCase()

    const response = await this.client.get(`/coins/${id}/market_chart/range`, {
      params: {
        vs_currency: vs,
        from: Math.floor(opts.start / 1000),
        to: Math.floor(opts.end / 1000)
      }
    })

    const results = response.data.prices.map((point) => ({
      price: point[1],
      ts: point[0]
    }))

    return this._cappedToMaxResults(results)
  }

  /** @internal */
  _cappedToMaxResults (results) {
    if (results.length <= this.MAX_HISTORICAL_ENTRIES) return results
    return this._cappedToMaxResults(results.filter((_, i) => i % 2 === 0))
  }
}
