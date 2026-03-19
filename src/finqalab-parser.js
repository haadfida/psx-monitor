// Finqalab PDF Parser
// Parses "Periodic Trade Details Report" PDFs from Finqalab
//
// Line format (trade rows):
//   TICKER TRADENO TRADEDATE SETTLEMENTDATE BUY|SELL RATE QTY TOTAL BROKER BROKERTOTAL CVT
//
// Summary rows (skip these):
//   BUY   QTY TOTAL
//   SELL  QTY TOTAL
//   TOTAL:
//
// Multiple trades for the same ticker are aggregated into a single position
// using weighted average cost.

const TRADE_LINE_REGEX =
  /^([A-Z][A-Z0-9]+)\s+(\d{7,})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(BUY|SELL)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/;

const HEADER_LINES = [
  "Periodic Trade Details Report",
  "Client Name:",
  "Period:",
  "Total Records:",
  "Security Trade No.",
];

/**
 * Parse raw text extracted from a Finqalab PDF into trade records
 * @param {string} text - Raw text from PDF extraction
 * @returns {{ trades: Array, positions: Array, meta: Object }}
 */
export function parseFinqalabText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Extract metadata
  const meta = {};
  for (const line of lines) {
    if (line.startsWith("Client Name:")) {
      meta.clientName = line.replace("Client Name:", "").trim();
    } else if (line.startsWith("Period:")) {
      meta.period = line.replace("Period:", "").trim();
    } else if (line.startsWith("Total Records:")) {
      meta.totalRecords = parseInt(line.replace("Total Records:", "").trim());
    }
  }

  // Parse individual trades
  const trades = [];
  for (const line of lines) {
    // Skip header/summary lines
    if (HEADER_LINES.some(h => line.includes(h))) continue;
    if (line.startsWith("BUY") || line.startsWith("SELL") || line.startsWith("TOTAL")) continue;

    const match = line.match(TRADE_LINE_REGEX);
    if (match) {
      trades.push({
        ticker: match[1],
        tradeNo: match[2],
        tradeDate: match[3],
        settlementDate: match[4],
        type: match[5], // BUY or SELL
        rate: parseFloat(match[6]),
        qty: parseInt(match[7]),
        total: parseFloat(match[8]),
        brokerRate: parseFloat(match[9]),
        brokerTotal: parseFloat(match[10]),
        cvt: parseInt(match[11]),
      });
    }
  }

  // Aggregate trades into positions (weighted average cost)
  const positionMap = {};
  for (const trade of trades) {
    const key = trade.ticker;
    if (!positionMap[key]) {
      positionMap[key] = {
        ticker: trade.ticker,
        buyShares: 0,
        buyTotal: 0,
        sellShares: 0,
        sellTotal: 0,
        trades: [],
        firstBuyDate: trade.tradeDate,
        lastTradeDate: trade.tradeDate,
      };
    }

    const pos = positionMap[key];
    pos.trades.push(trade);
    pos.lastTradeDate = trade.tradeDate;

    if (trade.type === "BUY") {
      pos.buyShares += trade.qty;
      pos.buyTotal += trade.total;
    } else {
      pos.sellShares += trade.qty;
      pos.sellTotal += trade.total;
    }
  }

  // Convert to position array with computed avg cost
  const positions = Object.values(positionMap).map(pos => {
    const netShares = pos.buyShares - pos.sellShares;
    const avgCost = pos.buyShares > 0 ? pos.buyTotal / pos.buyShares : 0;
    const totalBrokerFees = pos.trades.reduce((sum, t) => sum + t.brokerTotal, 0);

    return {
      ticker: pos.ticker,
      shares: netShares,
      avgCost: Math.round(avgCost * 100) / 100,
      totalInvested: Math.round(pos.buyTotal * 100) / 100,
      totalSold: Math.round(pos.sellTotal * 100) / 100,
      brokerFees: Math.round(totalBrokerFees * 100) / 100,
      buyDate: pos.firstBuyDate,
      lastTradeDate: pos.lastTradeDate,
      tradeCount: pos.trades.length,
      // These can be set by the user later
      targetSell: null,
      stopLoss: null,
      highSinceBuy: null,
      notes: "",
    };
  }).filter(pos => pos.shares > 0); // Only include positions with remaining shares

  return { trades, positions, meta };
}

/**
 * Extract text from a PDF File object using pdf.js
 * @param {File} file - PDF file from file input
 * @returns {Promise<string>} - Extracted text
 */
export async function extractTextFromPDF(file) {
  // Dynamically load pdf.js from CDN
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

/**
 * Full pipeline: File -> parsed positions
 * @param {File} file - PDF file from file input
 * @returns {Promise<{ trades: Array, positions: Array, meta: Object }>}
 */
export async function parseFinqalabPDF(file) {
  const text = await extractTextFromPDF(file);
  return parseFinqalabText(text);
}
