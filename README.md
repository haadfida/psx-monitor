# PSX Monitor — Pakistan Stock Exchange Intelligence Dashboard

A real-time stock monitoring dashboard for Pakistan Stock Exchange (PSX) with AI-powered news analysis.

## Features

- **8 Watchlist Stocks**: PSO, MEBL, UBL, SYS, LUCK, PPL, HBL, MCB
- **Composite Scoring**: Multi-factor score (0-100) based on P/E, upside, analyst consensus, dividends, ROE, beta
- **News Intelligence**: Market news with sentiment analysis and per-stock impact scores
- **Macro Risk Monitor**: Oil crisis, SBP rates, IMF program, Middle East conflict, PKR/USD, monsoon risk
- **Shariah Filter**: Identify Shariah-compliant stocks (MEBL, SYS, LUCK, PPL)
- **Comparison Table**: Side-by-side ranking of all stocks
- **AI Analysis** (optional): Connect your Anthropic API key for live news fetching and impact analysis via Claude

### 🔒 Private Portfolio (NEW)
- **Position Tracking**: Add your holdings with buy price, shares, target sell, and stop loss
- **P&L Dashboard**: Real-time unrealized gains/losses per position and total
- **Sell Signal Engine**: 8 types of automated sell signals:
  - 🛑 Stop Loss Hit — immediate action
  - 🎯 Target Price Reached — take profit
  - 📉 Trailing Stop — protect gains after pullback
  - 💰 Partial Profit — near analyst target
  - ⚠️ News Risk — high-impact negative news
  - 📊 Score Drop — fundamentals weakening
  - ⚖️ Overweight — position too concentrated (>25%)
  - 🔒 Lock Gains — unrealized profit >30%
- **100% Private**: All data stored in browser localStorage — never leaves your device
- **Sample Portfolio**: One-click load to test features before adding real positions

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/psx-monitor.git
cd psx-monitor

# Install dependencies
npm install

# Run locally
npm run dev
```

Open http://localhost:5173

## Enable Live News (Optional)

1. Get an API key from https://console.anthropic.com
2. Copy `.env.example` to `.env`
3. Add your key: `VITE_ANTHROPIC_API_KEY=sk-ant-...`
4. Restart the dev server

With the API key, the app will:
- Fetch live news via Claude's web search tool
- Analyze news impact on each stock using Claude Sonnet
- Generate sentiment scores and actionable insights

Without the key, the app uses curated fallback news data.

## Deploy to Vercel (Free)

### Option 1: Vercel CLI
```bash
npm i -g vercel
vercel
```

### Option 2: GitHub + Vercel
1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "PSX Monitor v1"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/psx-monitor.git
   git push -u origin main
   ```
2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Add environment variable: `VITE_ANTHROPIC_API_KEY` (if using live news)
5. Deploy — done!

Vercel auto-deploys on every push to main.

## Deploy to GitHub Pages (Alternative)

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json scripts:
# "deploy": "npm run build && gh-pages -d dist"

# In vite.config.js, add:
# base: '/psx-monitor/',

npm run deploy
```

## Project Structure

```
psx-monitor/
├── src/
│   ├── main.jsx          # Entry point
│   ├── App.jsx           # Main dashboard + portfolio UI
│   ├── data.js           # Stock data, macro factors, scoring
│   ├── news.js           # News module with AI analysis
│   └── portfolio.js      # Portfolio tracking, P&L, sell signals
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── README.md
```

## Extending

**Add more stocks**: Edit `WATCHLIST_STOCKS` in `src/data.js`
**Add macro factors**: Edit `MACRO_FACTORS` in `src/data.js`
**Add news sources**: Edit `NEWS_SOURCES` and `FALLBACK_NEWS` in `src/news.js`
**Custom scoring**: Modify `computeScore()` in `src/data.js`

## Data Sources

Stock data: Analyst estimates from PSX, Investing.com, SCS Trade (mid-March 2026)
News: Curated from Business Recorder, Dawn, Reuters, The News International
Macro: IMF, SBP, NDMA, Trading Economics

## Disclaimer

This is for informational and educational purposes only — not financial advice. Always consult a SECP-registered broker before making investment decisions. Past performance does not guarantee future results.

## License

MIT
