'use strict'

import { describe, expect, it, jest, beforeAll } from '@jest/globals'
import { CoingeckoPricingClient } from '../../index.js'

describe('Integration: CoingeckoPricingClient (real API)', () => {
  beforeAll(() => {
    jest.setTimeout(20000)
  })

  it('fetches current price from CoinGecko API', async () => {
    const client = new CoingeckoPricingClient()

    const price = await client.getCurrentPrice('BTC', 'USD')

    expect(typeof price).toBe('number')
    expect(price).toBeGreaterThan(0)
  })

  it('fetches multiple prices from CoinGecko API', async () => {
    const client = new CoingeckoPricingClient()

    const prices = await client.getMultiCurrentPrices([
      { from: 'BTC', to: 'USD' },
      { from: 'ETH', to: 'USD' }
    ])

    expect(prices).toHaveLength(2)
    expect(typeof prices[0]).toBe('number')
    expect(typeof prices[1]).toBe('number')
    expect(prices[0]).toBeGreaterThan(0)
    expect(prices[1]).toBeGreaterThan(0)
  })
})
