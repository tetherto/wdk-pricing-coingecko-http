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
//

'use strict'

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import axios from 'axios'
import { CoingeckoPricingClient } from '../index'

describe('CoingeckoPricingClient', () => {
  let client
  let mockGet

  beforeEach(() => {
    mockGet = jest.fn()
    axios.create = jest.fn().mockReturnValue({ get: mockGet })
    client = new CoingeckoPricingClient()
  })

  describe('constructor', () => {
    it('should accept custom coinIds to extend defaults', async () => {
      const custom = new CoingeckoPricingClient({
        coinIds: { PEPE: 'pepe' }
      })

      mockGet.mockResolvedValue({
        data: { pepe: { usd: 0.00001 } }
      })

      const price = await custom.getCurrentPrice('PEPE', 'USD')
      expect(price).toBe(0.00001)
    })

    it('should preserve default coin IDs when adding custom ones', async () => {
      const custom = new CoingeckoPricingClient({
        coinIds: { PEPE: 'pepe' }
      })

      mockGet.mockResolvedValue({
        data: { bitcoin: { usd: 65000 } }
      })

      const price = await custom.getCurrentPrice('BTC', 'USD')
      expect(price).toBe(65000)
    })

    it('should allow overriding default coin IDs', async () => {
      const custom = new CoingeckoPricingClient({
        coinIds: { BTC: 'wrapped-bitcoin' }
      })

      mockGet.mockResolvedValue({
        data: { 'wrapped-bitcoin': { usd: 64000 } }
      })

      const price = await custom.getCurrentPrice('BTC', 'USD')
      expect(price).toBe(64000)
    })

    it('should set demo API key header when apiKey is provided', () => {
      new CoingeckoPricingClient({ apiKey: 'CG-abc123' })

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.coingecko.com/api/v3',
        headers: { 'x-cg-demo-api-key': 'CG-abc123' }
      })
    })

    it('should set pro API key header when using pro base URL', () => {
      new CoingeckoPricingClient({
        baseURL: 'https://pro-api.coingecko.com/api/v3',
        apiKey: 'CG-pro456'
      })

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://pro-api.coingecko.com/api/v3',
        headers: { 'x-cg-pro-api-key': 'CG-pro456' }
      })
    })

    it('should not set any auth header when no apiKey is provided', () => {
      new CoingeckoPricingClient()

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.coingecko.com/api/v3',
        headers: {}
      })
    })
  })

  describe('getCurrentPrice', () => {
    it('should fetch the price for a single pair', async () => {
      mockGet.mockResolvedValue({
        data: { bitcoin: { usd: 65000.42 } }
      })

      const price = await client.getCurrentPrice('BTC', 'USD')

      expect(price).toBe(65000.42)
      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: { ids: 'bitcoin', vs_currencies: 'usd' }
      })
    })

    it('should normalize currency symbols', async () => {
      mockGet.mockResolvedValue({
        data: { ethereum: { eur: 2800 } }
      })

      const price = await client.getCurrentPrice('eth', 'EUR')

      expect(price).toBe(2800)
      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: { ids: 'ethereum', vs_currencies: 'eur' }
      })
    })

    it('should throw on unknown symbols', async () => {
      await expect(client.getCurrentPrice('FAKE', 'USD'))
        .rejects.toThrow('Unknown symbol: FAKE')
    })

    it('should return null when the API has no data for the pair', async () => {
      mockGet.mockResolvedValue({ data: {} })

      const price = await client.getCurrentPrice('BTC', 'USD')
      expect(price).toBeNull()
    })
  })

  describe('getMultiCurrentPrices', () => {
    it('should batch multiple pairs into one request', async () => {
      mockGet.mockResolvedValue({
        data: {
          bitcoin: { usd: 65000 },
          ethereum: { usd: 3100 }
        }
      })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(prices).toEqual([65000, 3100])
      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: { ids: 'bitcoin,ethereum', vs_currencies: 'usd' }
      })
    })

    it('should preserve input order regardless of response order', async () => {
      mockGet.mockResolvedValue({
        data: {
          ethereum: { usd: 3100 },
          bitcoin: { usd: 65000 }
        }
      })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(prices).toEqual([65000, 3100])
    })

    it('should handle mixed quote currencies', async () => {
      mockGet.mockResolvedValue({
        data: {
          bitcoin: { usd: 65000, eur: 60000 }
        }
      })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'BTC', to: 'EUR' }
      ])

      expect(prices).toEqual([65000, 60000])
      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: { ids: 'bitcoin', vs_currencies: 'usd,eur' }
      })
    })

    it('should deduplicate coin IDs in the request', async () => {
      mockGet.mockResolvedValue({
        data: { bitcoin: { usd: 65000, eur: 60000 } }
      })

      await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'BTC', to: 'EUR' }
      ])

      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: { ids: 'bitcoin', vs_currencies: 'usd,eur' }
      })
    })

    it('should return empty array for empty input', async () => {
      mockGet.mockResolvedValue({ data: {} })

      const prices = await client.getMultiCurrentPrices([])
      expect(prices).toEqual([])
    })

    it('should return null for pairs the API has no data for', async () => {
      mockGet.mockResolvedValue({ data: { bitcoin: { usd: 65000 } } })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(prices).toEqual([65000, null])
    })
  })

  describe('getMultiPriceData', () => {
    it('should return price data with computed daily change', async () => {
      mockGet.mockResolvedValue({
        data: {
          bitcoin: { usd: 65000, usd_24h_change: 2.5 },
          ethereum: { usd: 3100, usd_24h_change: -1.2 }
        }
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      // BTC: 2.5% on 65000 → previous was ~63414.63, change is ~1585.37
      expect(result[0].lastPrice).toBe(65000)
      expect(result[0].dailyChangeRelative).toBeCloseTo(0.025, 10)
      expect(result[0].dailyChange).toBeCloseTo(1585.37, 0)

      // ETH: -1.2% on 3100 → previous was ~3137.65, change is ~-37.65
      expect(result[1].lastPrice).toBe(3100)
      expect(result[1].dailyChangeRelative).toBeCloseTo(-0.012, 10)
      expect(result[1].dailyChange).toBeCloseTo(-37.65, 0)
    })

    it('should preserve input order', async () => {
      mockGet.mockResolvedValue({
        data: {
          ethereum: { usd: 3100, usd_24h_change: 0.5 },
          bitcoin: { usd: 65000, usd_24h_change: 1.0 }
        }
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(result[0].lastPrice).toBe(65000)
      expect(result[1].lastPrice).toBe(3100)
    })

    it('should request with include_24hr_change param', async () => {
      mockGet.mockResolvedValue({
        data: { bitcoin: { usd: 65000, usd_24h_change: 0.1 } }
      })

      await client.getMultiPriceData([{ from: 'BTC', to: 'USD' }])

      expect(mockGet).toHaveBeenCalledWith('/simple/price', {
        params: {
          ids: 'bitcoin',
          vs_currencies: 'usd',
          include_24hr_change: true
        }
      })
    })

    it('should return empty array for empty input', async () => {
      mockGet.mockResolvedValue({ data: {} })

      const result = await client.getMultiPriceData([])
      expect(result).toEqual([])
    })

    it('should return null for pairs the API has no data for', async () => {
      mockGet.mockResolvedValue({
        data: { bitcoin: { usd: 65000, usd_24h_change: 1.0 } }
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(result[0].lastPrice).toBe(65000)
      expect(result[1]).toBeNull()
    })
  })

  describe('getHistoricalPrice', () => {
    const HOUR = 3600000
    // Anchor ranges to "now" so they stay inside the free-tier 365-day window.
    const end = Date.now()

    it('should return mapped historical data', async () => {
      const start = end - (3 * HOUR)

      mockGet.mockResolvedValue({
        data: {
          prices: [
            [start, 62000],
            [start + HOUR, 62500],
            [end, 63000]
          ]
        }
      })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(result).toEqual([
        { price: 62000, timestamp: start },
        { price: 62500, timestamp: start + HOUR },
        { price: 63000, timestamp: end }
      ])

      expect(mockGet).toHaveBeenCalledWith('/coins/bitcoin/market_chart/range', {
        params: {
          vs_currency: 'usd',
          from: Math.floor(start / 1000),
          to: Math.floor(end / 1000)
        }
      })
    })

    it('should return every point by default (no capping)', async () => {
      const start = end - (200 * HOUR)

      const prices = Array.from({ length: 200 }, (_, i) => [
        start + (i * HOUR),
        60000 + i
      ])

      mockGet.mockResolvedValue({ data: { prices } })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(result.length).toBe(200)
    })

    it('should evenly downsample to maxEntries, preserving first and last', async () => {
      const start = end - (200 * HOUR)

      const prices = Array.from({ length: 200 }, (_, i) => [
        start + (i * HOUR),
        60000 + i
      ])

      mockGet.mockResolvedValue({ data: { prices } })

      const result = await client.getHistoricalPrice('BTC', 'USD', {
        start,
        end,
        maxEntries: 100
      })

      expect(result.length).toBe(100)
      // First and last points are always retained.
      expect(result[0]).toEqual({ price: 60000, timestamp: start })
      expect(result[99]).toEqual({ price: 60199, timestamp: start + 199 * HOUR })
    })

    it('should not downsample when result is already within maxEntries', async () => {
      const start = end - (3 * HOUR)

      mockGet.mockResolvedValue({
        data: {
          prices: [
            [start, 62000],
            [start + HOUR, 62500],
            [end, 63000]
          ]
        }
      })

      const result = await client.getHistoricalPrice('BTC', 'USD', {
        start,
        end,
        maxEntries: 100
      })

      expect(result.length).toBe(3)
    })

    it('should throw for start older than 365 days on a non-Pro client', async () => {
      const start = Date.now() - (366 * 24 * HOUR)

      await expect(
        client.getHistoricalPrice('BTC', 'USD', { start, end: Date.now() })
      ).rejects.toThrow('requires a CoinGecko Pro API key')

      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should allow start older than 365 days on a Pro client', async () => {
      const proClient = new CoingeckoPricingClient({
        baseURL: 'https://pro-api.coingecko.com/api/v3',
        apiKey: 'CG-pro456'
      })
      const start = Date.now() - (400 * 24 * HOUR)

      mockGet.mockResolvedValue({ data: { prices: [] } })

      await expect(
        proClient.getHistoricalPrice('BTC', 'USD', { start, end: Date.now() })
      ).resolves.toEqual([])
    })

    it('should convert timestamps to seconds for the API call', async () => {
      const start = end - (3 * HOUR)

      mockGet.mockResolvedValue({ data: { prices: [] } })

      await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(mockGet).toHaveBeenCalledWith('/coins/bitcoin/market_chart/range', {
        params: {
          vs_currency: 'usd',
          from: Math.floor(start / 1000),
          to: Math.floor(end / 1000)
        }
      })
    })

    it('should throw when start or end is missing', async () => {
      await expect(client.getHistoricalPrice('BTC', 'USD'))
        .rejects.toThrow('start and end timestamps are required')

      await expect(client.getHistoricalPrice('BTC', 'USD', { start: 1000 }))
        .rejects.toThrow('start and end timestamps are required')

      await expect(client.getHistoricalPrice('BTC', 'USD', { end: 2000 }))
        .rejects.toThrow('start and end timestamps are required')
    })
  })
})
