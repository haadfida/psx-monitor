// PSX Live Price Fetcher
// Uses dps.psx.com.pk public endpoints — no API key needed
//
// Endpoints:
//   /market-watch          → all stocks current price, change, volume
//   /timeseries/eod/{SYM}  → historical EOD data (5 years)
//   /timeseries/int/{SYM}  → intraday data
//   /company/{SYM}         → company profile

const PSX_BASE = "https://dps.psx.com.pk";

// CORS proxy — PSX doesn't set CORS headers, so we need a proxy for browser requests
// Options: use a Vercel serverless function, or a public CORS proxy
// For dev, we use corsproxy.io. For production, deploy your own proxy.
const CORS_PROXY = "https://corsproxy.io/?";

async function fetchPSX(endpoint) {
  try {
    const url = `${CORS_PROXY}${encodeURIComponent(PSX_BASE + endpoint)}`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error(`PSX fetch failed: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`PSX fetch error for ${endpoint}:`, err);
    return null;
  }
}

/**
 * Fetch current market prices for all stocks
 * Returns: { SYMBOL: { price, change, changePct, volume, high, low, open, ... } }
 */
export async function fetchMarketWatch() {
  const data = await fetchPSX("/market-watch");
  if (!data || !Array.isArray(data)) return null;

  const prices = {};
  for (const stock of data) {
    const symbol = stock.symbol || stock.SYMBOL;
    if (!symbol) continue;
    prices[symbol] = {
      price: parseFloat(stock.current || stock.CURRENT || stock.close || 0),
      change: parseFloat(stock.change || stock.CHANGE || 0),
      changePct: parseFloat(stock.change_p || stock.CHANGE_P || stock.percent_change || 0),
      volume: parseInt(stock.volume || stock.VOLUME || 0),
      high: parseFloat(stock.high || stock.HIGH || 0),
      low: parseFloat(stock.low || stock.LOW || 0),
      open: parseFloat(stock.open || stock.OPEN || 0),
      prevClose: parseFloat(stock.prev_close || stock.PREV_CLOSE || 0),
      turnover: parseFloat(stock.turnover || stock.TURNOVER || 0),
    };
  }
  return prices;
}

/**
 * Fetch EOD historical data for a specific stock
 * @param {string} symbol - e.g. "PSO", "HBL"
 * @returns {Array} - [{ date, open, high, low, close, volume }, ...]
 */
export async function fetchEOD(symbol) {
  const data = await fetchPSX(`/timeseries/eod/${symbol}`);
  if (!data || !Array.isArray(data)) return [];
  return data.map(d => ({
    date: d.date || d.DATE,
    open: parseFloat(d.open || d.OPEN || 0),
    high: parseFloat(d.high || d.HIGH || 0),
    low: parseFloat(d.low || d.LOW || 0),
    close: parseFloat(d.close || d.CLOSE || 0),
    volume: parseInt(d.volume || d.VOLUME || 0),
  }));
}

/**
 * Fetch intraday data for a specific stock
 * @param {string} symbol
 * @returns {Array}
 */
export async function fetchIntraday(symbol) {
  const data = await fetchPSX(`/timeseries/int/${symbol}`);
  if (!data || !Array.isArray(data)) return [];
  return data;
}

/**
 * Fetch prices for a list of tickers
 * Uses market-watch endpoint (single call for all stocks)
 * @param {string[]} tickers - ["PSO", "HBL", "SYS", ...]
 * @returns {Object} - { PSO: { price, change, ... }, HBL: { ... } }
 */
export async function fetchPricesForTickers(tickers) {
  const allPrices = await fetchMarketWatch();
  if (!allPrices) return null;

  const result = {};
  for (const ticker of tickers) {
    if (allPrices[ticker]) {
      result[ticker] = allPrices[ticker];
    }
  }
  return result;
}

/**
 * Update stock data object with live prices
 * Merges live prices into the existing WATCHLIST_STOCKS structure
 * @param {Object} watchlistStocks - current stock data
 * @param {Object} livePrices - from fetchPricesForTickers
 * @returns {Object} - updated stock data
 */
export function mergeLivePrices(watchlistStocks, livePrices) {
  if (!livePrices) return watchlistStocks;

  const updated = { ...watchlistStocks };
  for (const [ticker, prices] of Object.entries(livePrices)) {
    if (updated[ticker]) {
      updated[ticker] = {
        ...updated[ticker],
        price: prices.price || updated[ticker].price,
        prevClose: prices.prevClose || updated[ticker].prevClose,
        volume: prices.volume ? `${(prices.volume / 1000000).toFixed(1)}M` : updated[ticker].volume,
        // Update 52-week high if current price exceeds it
        weekHigh52: Math.max(updated[ticker].weekHigh52, prices.high || 0),
      };
    }
  }
  return updated;
}
