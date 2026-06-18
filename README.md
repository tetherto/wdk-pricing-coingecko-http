# @tetherto/wdk-pricing-coingecko-http

Note: This package is in beta. Please test in a dev setup first.

HTTP client for prices from CoinGecko. It uses the [CoinGecko HTTP API](https://docs.coingecko.com/reference/introduction) to obtain current prices and historical data for a given ticker, and serves as a fallback for the Bitfinex provider when that becomes unavailable.

It works as a `PricingClient` for [`@tetherto/wdk-pricing-provider`](https://github.com/tetherto/lib-wallet-pricing-provider).

## 🔍 About WDK

This module is part of the WDK (Wallet Development Kit) project. Learn more at https://docs.wallet.tether.io.

## ✨ Features

- Compatible with [@tetherto/wdk-pricing-provider](https://github.com/tetherto/lib-wallet-pricing-provider)
- Current price for a single pair, or batched for many pairs in one request
- Full price data (last price + daily change) batched in one request
- Historical prices over a time range, with optional even downsampling
- Configurable symbol → CoinGecko ID map, extensible per instance
- Demo and Pro API key support (auth header auto-selected from the base URL)

## ⬇️ Installation

```bash
npm install @tetherto/wdk-pricing-coingecko-http
```

## 🚀 Quick Start

```javascript
import { CoingeckoPricingClient } from '@tetherto/wdk-pricing-coingecko-http'

// Public host, no key (subject to CoinGecko's free-tier rate limits)
const client = new CoingeckoPricingClient()

// Demo API key for higher rate limits
const demo = new CoingeckoPricingClient({ apiKey: 'CG-xxx' })

// Pro API key (use the Pro host so the correct auth header is sent)
const pro = new CoingeckoPricingClient({
  baseURL: 'https://pro-api.coingecko.com/api/v3',
  apiKey: 'CG-xxx'
})

// Extend / override the symbol → CoinGecko ID map
const custom = new CoingeckoPricingClient({
  coinIds: { PEPE: 'pepe', SHIB: 'shiba-inu' }
})

const price = await client.getCurrentPrice('BTC', 'USD')
```

## 📚 API Reference

### Constructor

```javascript
new CoingeckoPricingClient(options?)
```

| Option    | Type                     | Description                                                                                            |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `baseURL` | `string`                 | CoinGecko API base URL. Use the Pro host with a Pro key. Default: `https://api.coingecko.com/api/v3`.  |
| `coinIds` | `Object<string, string>` | Symbol → CoinGecko ID overrides, merged on top of the built-in defaults (`BTC, ETH, USDT, XAUT, USAT`). |
| `apiKey`  | `string`                 | CoinGecko API key. The Demo or Pro auth header is chosen automatically from `baseURL`.                 |

The `from` argument of every method is an asset ticker symbol (e.g. `BTC`) resolved to a CoinGecko ID via `coinIds`; `to` is a currency code CoinGecko accepts as `vs_currency` (e.g. `USD`). Both are case-insensitive. An unknown `from` throws; add it via `coinIds`.

### Methods

| Method                               | Description                             | Returns                            |
| ------------------------------------ | --------------------------------------- | ---------------------------------- |
| `getCurrentPrice(from, to)`          | Current price for one pair              | `Promise<number \| null>`          |
| `getMultiCurrentPrices(list)`        | Current prices for many pairs (batched) | `Promise<Array<number \| null>>`   |
| `getMultiPriceData(list)`            | Last price + daily change (batched)     | `Promise<Array<PriceData \| null>>`|
| `getHistoricalPrice(from, to, opts)` | Historical prices over a range          | `Promise<HistoricalPriceResult[]>` |

`list` is an array of `{ from, to }` pairs. For the batched methods, results are returned in the same order as the input; an entry resolves to `null` when CoinGecko has no data for that pair (matching the sibling fallback providers).

#### `getHistoricalPrice(from, to, opts)`

```javascript
const series = await client.getHistoricalPrice('BTC', 'USD', {
  start: Date.now() - 7 * 24 * 60 * 60 * 1000, // required, Unix ms
  end: Date.now(),                              // required, Unix ms
  maxEntries: 100                               // optional even downsample
})
```

- `start` and `end` (Unix milliseconds) are **required**.
- Without `maxEntries`, every point CoinGecko returns is included. When set, the result is evenly downsampled to at most `maxEntries` points, always keeping the first and last point.
- On the free/Demo tier, `start` must be within the trailing 365 days; older ranges require a Pro key. See the [CoinGecko docs](https://www.coingecko.com/learn/download-bitcoin-historical-data).

> Note: CoinGecko exposes the 24h change only as a percentage, so the absolute `dailyChange` in `getMultiPriceData` is derived from the last price and that percentage and is therefore an approximation.

## ⚠️ Rate limits

CoinGecko's free tier rate-limits at ~10–30 req/min, so integration tests may `429` under repeated runs. Provide an `apiKey` to raise the limit.

## 🛠️ Development

```bash
npm install
npm run lint
npm test
npm run test:coverage
npm run test:integration   # hits the live CoinGecko API
npm run build:types        # regenerate types/ after JSDoc changes
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.
