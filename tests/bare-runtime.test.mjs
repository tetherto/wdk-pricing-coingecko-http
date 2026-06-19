import test from 'brittle'

import { CoingeckoPricingClient } from '../bare.js'

test('bare runtime: exports pricing client', t => {
  t.ok(CoingeckoPricingClient, 'CoingeckoPricingClient should be exported')
  const client = new CoingeckoPricingClient()
  t.ok(client, 'instance should be constructible')
  t.ok(typeof client.getCurrentPrice === 'function', 'getCurrentPrice should exist')
  t.ok(typeof client.getHistoricalPrice === 'function', 'getHistoricalPrice should exist')
})
