import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart3,
  Activity, ArrowUpRight, ArrowDownRight, Clock, Zap, Shield, Target,
  Newspaper, Globe, ChevronRight, ExternalLink, AlertCircle, CheckCircle,
  XCircle, Minus, Filter, Lock, Briefcase, Plus, Edit2, Trash2, Upload,
  FileText, Check, RefreshCw, Wifi, WifiOff, Loader,
} from "lucide-react";
import {
  WATCHLIST_STOCKS, KSE100_DATA, SECTOR_DATA, MACRO_FACTORS, computeScore,
} from "./data.js";
import {
  FALLBACK_NEWS, getNewsForStock, getLatestNews, getNewsSentimentSummary,
  getNewsAnalysis, getNewsStatus,
} from "./news.js";
import {
  generateSellSignals, calculatePositionPnL, calculatePortfolioSummary,
  SIGNAL_TYPES, SAMPLE_PORTFOLIO, getMonthlyAdvice,
} from "./portfolio.js";
import { parseFinqalabText } from "./finqalab-parser.js";

const C = {
  bg: "#0a0f1a", card: "#111827", cardHover: "#1a2236",
  border: "#1e293b", borderLight: "#334155",
  text: "#e2e8f0", textMuted: "#94a3b8", textDim: "#64748b",
  accent: "#22d3ee", accentDim: "#0e7490",
  green: "#10b981", greenDim: "#065f46",
  red: "#ef4444", redDim: "#7f1d1d",
  amber: "#f59e0b", purple: "#a78bfa", pink: "#f472b6", blue: "#3b82f6",
};

const SENTIMENT_CONFIG = {
  positive: { color: C.green, icon: <CheckCircle size={12} />, bg: "rgba(16,185,129,0.08)" },
  negative: { color: C.red, icon: <XCircle size={12} />, bg: "rgba(239,68,68,0.08)" },
  neutral: { color: C.textDim, icon: <Minus size={12} />, bg: "rgba(100,116,139,0.08)" },
  mixed: { color: C.amber, icon: <AlertCircle size={12} />, bg: "rgba(245,158,11,0.08)" },
};

const STATUS_CONFIG = {
  high_risk: { color: C.red, label: "HIGH RISK", bg: "rgba(239,68,68,0.1)" },
  moderate_risk: { color: C.amber, label: "MODERATE", bg: "rgba(245,158,11,0.1)" },
  positive: { color: C.green, label: "POSITIVE", bg: "rgba(16,185,129,0.1)" },
  stable: { color: C.blue, label: "STABLE", bg: "rgba(59,130,246,0.1)" },
  watching: { color: C.purple, label: "WATCHING", bg: "rgba(167,139,250,0.1)" },
};

function ScoreGauge({ score, size = 56, label }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? C.green : score >= 50 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={size * 0.28} fontWeight="700"
          style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>{score}</text>
      </svg>
      {label && <span style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>}
    </div>
  );
}

function StockCard({ ticker, stock, isSelected, onClick }) {
  const change = stock.price - stock.prevClose;
  const changePct = ((change / stock.prevClose) * 100).toFixed(2);
  const isUp = change >= 0;
  const upside = (((stock.targetPrice - stock.price) / stock.price) * 100).toFixed(1);
  const score = computeScore(stock);
  const stockNews = getNewsForStock(ticker);
  const hasAlert = stockNews.some(n => n.impactScore >= 70);

  return (
    <div onClick={onClick} style={{
      background: isSelected ? C.cardHover : C.card,
      border: `1px solid ${isSelected ? C.accent : C.border}`,
      borderRadius: 12, padding: "14px 16px", cursor: "pointer",
      transition: "all 0.2s", position: "relative", overflow: "hidden",
    }}>
      {hasAlert && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${C.red}, ${C.amber})`,
        }} />
      )}
      {stock.shariah && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(34,211,238,0.1)", border: `1px solid ${C.accentDim}`,
          borderRadius: 6, padding: "2px 6px", fontSize: 9, color: C.accent, fontWeight: 600,
        }}>SHARIAH</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: 0.5 }}>{ticker}</div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{stock.sector}</div>
        </div>
        <ScoreGauge score={score} size={40} />
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>₨{stock.price}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: isUp ? C.green : C.red, display: "flex", alignItems: "center", gap: 2 }}>
          {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {isUp ? "+" : ""}{changePct}%
        </span>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 10, fontSize: 10, color: C.textMuted }}>
        <span>P/E <b style={{ color: C.text }}>{stock.pe}x</b></span>
        <span>↑ <b style={{ color: C.accent }}>{upside}%</b></span>
        {hasAlert && <span style={{ color: C.amber, display: "flex", alignItems: "center", gap: 2 }}>
          <AlertTriangle size={10} /> News Alert
        </span>}
      </div>
      <div style={{ marginTop: 8, height: 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stock.priceHistory.map(p => ({ v: p }))}>
            <defs>
              <linearGradient id={`g-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? C.green : C.red} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isUp ? C.green : C.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={isUp ? C.green : C.red}
              strokeWidth={1.5} fill={`url(#g-${ticker})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MacroFactorsPanel() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <Globe size={14} color={C.accent} /> Macro Factors & Risks
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MACRO_FACTORS.map(f => {
          const cfg = STATUS_CONFIG[f.status];
          return (
            <div key={f.id} style={{
              background: cfg.bg, border: `1px solid ${cfg.color}22`,
              borderRadius: 8, padding: "10px 12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{f.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: cfg.color,
                  background: `${cfg.color}15`, padding: "2px 6px", borderRadius: 4,
                }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5, marginBottom: 6 }}>{f.description}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {f.affectedTickers.map(t => (
                  <span key={t} style={{
                    fontSize: 9, fontWeight: 600, color: C.accent,
                    background: "rgba(34,211,238,0.08)", padding: "1px 5px", borderRadius: 3,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewsFeedPanel({ selectedStock }) {
  const [newsFilter, setNewsFilter] = useState("all");
  const [liveNews, setLiveNews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const status = getNewsStatus();

  const tickers = Object.keys(WATCHLIST_STOCKS);

  // Fetch live news on mount
  useEffect(() => {
    if (!status.hasApiKey) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getNewsAnalysis(tickers, false);
        if (!cancelled) {
          setLiveNews(result);
          setCacheInfo({
            fromCache: result.fromCache,
            cacheAge: result.cacheAge,
            isLive: result.isLive,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Determine which articles to show
  const articles = liveNews?.articles || FALLBACK_NEWS;
  const news = newsFilter === "stock"
    ? articles.filter(n => n.affectedTickers?.includes(selectedStock))
    : articles.slice(0, 10);
  const sentiment = getNewsSentimentSummary(articles);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
          <Newspaper size={14} color={C.accent} /> News Intelligence
          {liveNews?.isLive ? (
            <span style={{ fontSize: 8, color: C.green, background: "rgba(16,185,129,0.12)", padding: "2px 6px", borderRadius: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              <Wifi size={8} /> LIVE
            </span>
          ) : (
            <span style={{ fontSize: 8, color: C.textDim, background: "rgba(100,116,139,0.12)", padding: "2px 6px", borderRadius: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              <WifiOff size={8} /> STATIC
            </span>
          )}
        </div>
        {cacheInfo && (
          <span style={{ fontSize: 8, color: C.textDim }}>
            {cacheInfo.fromCache ? `Updated ${cacheInfo.cacheAge}` : "Just updated"}
          </span>
        )}
      </div>

      {liveNews?.topAction && (
        <div style={{
          padding: "8px 10px", marginBottom: 10, background: "rgba(34,211,238,0.06)",
          border: `1px solid ${C.accentDim}`, borderRadius: 8,
          fontSize: 10, color: C.accent, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Target size={12} /> {liveNews.topAction}
        </div>
      )}

      {liveNews?.marketSummary && (
        <div style={{
          padding: "6px 10px", marginBottom: 10, background: C.bg,
          borderRadius: 6, fontSize: 10, color: C.textMuted, lineHeight: 1.5,
          border: `1px solid ${C.border}`,
        }}>
          {liveNews.marketSummary}
        </div>
      )}

      {error && (
        <div style={{
          padding: "6px 10px", marginBottom: 10, background: "rgba(239,68,68,0.08)",
          borderRadius: 6, fontSize: 10, color: C.red,
        }}>
          Failed to fetch: {error}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[
          { id: "all", label: "All News" },
          { id: "stock", label: selectedStock },
        ].map(f => (
          <button key={f.id} onClick={() => setNewsFilter(f.id)} style={{
            background: newsFilter === f.id ? "rgba(34,211,238,0.1)" : "transparent",
            border: `1px solid ${newsFilter === f.id ? C.accent : C.border}`,
            color: newsFilter === f.id ? C.accent : C.textDim,
            padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
          }}>{f.label}</button>
        ))}
      </div>

      {/* Sentiment bar */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 10, padding: "6px 10px",
        background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 10, color: C.textDim }}>
          Sentiment:
          <span style={{
            marginLeft: 6, fontWeight: 700,
            color: parseInt(sentiment.ratio) > 0 ? C.green : parseInt(sentiment.ratio) < 0 ? C.red : C.amber,
          }}>
            {parseInt(sentiment.ratio) > 0 ? "+" : ""}{sentiment.ratio}%
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 2, alignItems: "center" }}>
          <div style={{ height: 6, flex: sentiment.positive || 1, background: C.green, borderRadius: "3px 0 0 3px" }} />
          <div style={{ height: 6, flex: sentiment.neutral || 1, background: C.textDim }} />
          <div style={{ height: 6, flex: sentiment.negative || 1, background: C.red, borderRadius: "0 3px 3px 0" }} />
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 9, color: C.textDim }}>
          <span style={{ color: C.green }}>+{sentiment.positive}</span>
          <span>{sentiment.neutral}</span>
          <span style={{ color: C.red }}>-{sentiment.negative}</span>
        </div>
      </div>

      {/* Loading state */}
      {loading && !liveNews && (
        <div style={{ padding: 30, textAlign: "center" }}>
          <Loader size={20} color={C.accent} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: C.textMuted }}>Analyzing global news impact on your portfolio...</div>
          <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>Searching web + mapping to your positions</div>
        </div>
      )}

      {/* News items */}
      {(!loading || liveNews) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
          {news.map(n => {
            const scfg = SENTIMENT_CONFIG[n.sentiment] || SENTIMENT_CONFIG.neutral;
            const time = new Date(n.timestamp);
            const hoursAgo = Math.round((Date.now() - time.getTime()) / 3600000);
            return (
              <div key={n.id} style={{
                background: scfg.bg, border: `1px solid ${scfg.color}15`,
                borderRadius: 8, padding: "10px 12px",
                borderLeft: `3px solid ${scfg.color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>
                      {n.headline}
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5, marginBottom: 6 }}>
                      {n.analysis}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9, color: C.textDim }}>{n.source}</span>
                      <span style={{ fontSize: 9, color: C.textDim }}>·</span>
                      <span style={{ fontSize: 9, color: C.textDim }}>{hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo/24)}d ago`}</span>
                      <span style={{ fontSize: 9, color: C.textDim }}>·</span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: scfg.color,
                        display: "flex", alignItems: "center", gap: 2,
                      }}>{scfg.icon} {n.sentiment}</span>
                      {n.urgency && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                          color: n.urgency === "immediate" ? C.red : n.urgency === "soon" ? C.amber : C.textDim,
                          background: n.urgency === "immediate" ? "rgba(239,68,68,0.12)" : n.urgency === "soon" ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.08)",
                          padding: "1px 5px", borderRadius: 3,
                        }}>{n.urgency}</span>
                      )}
                      <div style={{ display: "flex", gap: 3 }}>
                        {(n.affectedTickers || []).map(t => (
                          <span key={t} style={{
                            fontSize: 8, fontWeight: 700, color: C.accent,
                            background: "rgba(34,211,238,0.08)", padding: "1px 4px", borderRadius: 3,
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    minWidth: 36, height: 36, borderRadius: 8,
                    background: `${scfg.color}12`, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: scfg.color }}>{n.impactScore}</span>
                    <span style={{ fontSize: 7, color: C.textDim }}>IMPACT</span>
                  </div>
                </div>
              </div>
            );
          })}
          {news.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: C.textDim, fontSize: 12 }}>
              {newsFilter === "stock" ? `No news affecting ${selectedStock}` : "No news available"}
            </div>
          )}
        </div>
      )}

      {/* No API key message */}
      {!status.hasApiKey && (
        <div style={{
          marginTop: 10, padding: "8px 10px", background: "rgba(245,158,11,0.06)",
          border: `1px solid rgba(245,158,11,0.15)`, borderRadius: 6,
          fontSize: 9, color: C.textDim,
        }}>
          Add VITE_ANTHROPIC_API_KEY to .env for live news analysis. Showing static fallback data.
        </div>
      )}
    </div>
  );
}

function DetailPanel({ ticker, stock }) {
  const [activeTab, setActiveTab] = useState("overview");
  const change = stock.price - stock.prevClose;
  const changePct = ((change / stock.prevClose) * 100).toFixed(2);
  const isUp = change >= 0;
  const upside = (((stock.targetPrice - stock.price) / stock.price) * 100).toFixed(1);
  const score = computeScore(stock);
  const fromHigh = (((stock.weekHigh52 - stock.price) / stock.weekHigh52) * 100).toFixed(1);
  const fromLow = (((stock.price - stock.weekLow52) / stock.weekLow52) * 100).toFixed(1);
  const chartData = stock.priceHistory.map((p, i) => ({ month: stock.months[i], price: p, volume: stock.volumeHistory[i] }));
  const stockNews = getNewsForStock(ticker);

  const radarData = [
    { metric: "Value", value: stock.pe < 7 ? 95 : stock.pe < 10 ? 75 : stock.pe < 15 ? 55 : 35 },
    { metric: "Growth", value: Math.min(95, parseFloat(upside) * 2) },
    { metric: "Dividend", value: Math.min(95, stock.dividendYield * 10) },
    { metric: "Stability", value: stock.beta < 1 ? 85 : stock.beta < 1.2 ? 65 : 45 },
    { metric: "Momentum", value: isUp ? 75 : 40 },
    { metric: "Quality", value: Math.min(95, stock.roe * 3.5) },
  ];

  const tabs = ["overview", "chart", "analysis", "news"];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: 1 }}>{ticker}</span>
            {stock.shariah && (
              <span style={{ background: "rgba(34,211,238,0.12)", border: `1px solid ${C.accentDim}`, borderRadius: 6, padding: "2px 7px", fontSize: 9, color: C.accent, fontWeight: 600 }}>☪ SHARIAH</span>
            )}
            <span style={{
              background: stock.analystRating === "Strong Buy" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)",
              border: `1px solid ${stock.analystRating === "Strong Buy" ? C.greenDim : "rgba(59,130,246,0.3)"}`,
              borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 600,
              color: stock.analystRating === "Strong Buy" ? C.green : C.blue,
            }}>{stock.analystRating} ({stock.analystCount})</span>
            {stockNews.some(n => n.impactScore >= 70) && (
              <span style={{ background: "rgba(239,68,68,0.12)", border: `1px solid ${C.redDim}`, borderRadius: 6, padding: "2px 7px", fontSize: 9, color: C.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                <AlertTriangle size={10} /> NEWS ALERT
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{stock.name} · {stock.sector}</div>
        </div>
        <ScoreGauge score={score} label="Score" size={60} />
      </div>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: C.text }}>₨{stock.price}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: isUp ? C.green : C.red, display: "flex", alignItems: "center", gap: 2 }}>
          {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {isUp ? "+" : ""}{changePct}%
        </span>
        <span style={{ fontSize: 12, color: C.textDim }}>Target: <b style={{ color: C.green }}>₨{stock.targetPrice}</b> ({upside}%↑)</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background: "transparent", border: "none",
            borderBottom: `2px solid ${activeTab === t ? C.accent : "transparent"}`,
            color: activeTab === t ? C.accent : C.textDim,
            padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            textTransform: "capitalize",
          }}>{t === "news" ? `News (${stockNews.length})` : t}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Key Metrics</div>
            {[
              ["P/E Ratio", `${stock.pe}x`, stock.pe < 10 ? C.green : C.amber],
              ["Market Cap", `₨${stock.marketCap}`, C.text],
              ["EPS (TTM)", `₨${stock.eps}`, C.text],
              ["ROE", `${stock.roe}%`, stock.roe > 20 ? C.green : C.text],
              ["Div. Yield", `${stock.dividendYield}%`, stock.dividendYield > 5 ? C.green : C.text],
              ["Beta", stock.beta, stock.beta < 1 ? C.green : stock.beta > 1.3 ? C.red : C.amber],
              ["Volume", stock.volume, C.text],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>52-Week Range</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 5 }}>
              <span>₨{stock.weekLow52}</span><span>₨{stock.weekHigh52}</span>
            </div>
            <div style={{ height: 8, background: C.border, borderRadius: 4, position: "relative" }}>
              <div style={{
                position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 4,
                width: `${((stock.price - stock.weekLow52) / (stock.weekHigh52 - stock.weekLow52)) * 100}%`,
                background: `linear-gradient(90deg, ${C.accentDim}, ${C.accent})`,
              }} />
            </div>
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 10, color: C.textMuted }}>
              <b style={{ color: C.green }}>+{fromLow}%</b> from low · <b style={{ color: C.red }}>-{fromHigh}%</b> from high
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Catalysts</div>
              {stock.catalysts.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontSize: 10, color: C.green }}>
                  <Zap size={9} /> {c}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Risks</div>
              {stock.risks.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontSize: 10, color: C.amber }}>
                  <AlertTriangle size={9} /> {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "chart" && (
        <div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" stroke={C.textDim} fontSize={10} />
                <YAxis stroke={C.textDim} fontSize={10} domain={["dataMin - 20", "dataMax + 20"]} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                <Area type="monotone" dataKey="price" stroke={C.accent} strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: C.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 80, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="month" stroke={C.textDim} fontSize={9} />
                <YAxis stroke={C.textDim} fontSize={9} />
                <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? C.accent : C.borderLight} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "analysis" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Multi-Factor Radar</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis dataKey="metric" stroke={C.textDim} fontSize={10} />
                  <Radar dataKey="value" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Investment Profile</div>
            {[
              { icon: <Target size={12} />, label: "Upside", value: `${upside}%`, color: parseFloat(upside) > 25 ? C.green : C.amber },
              { icon: <Shield size={12} />, label: "Risk", value: stock.beta < 1 ? "Low" : stock.beta < 1.3 ? "Medium" : "High", color: stock.beta < 1 ? C.green : stock.beta < 1.3 ? C.amber : C.red },
              { icon: <DollarSign size={12} />, label: "Income", value: stock.dividendYield > 5 ? "Strong" : stock.dividendYield > 2 ? "Moderate" : "Low", color: stock.dividendYield > 5 ? C.green : C.text },
              { icon: <Zap size={12} />, label: "Momentum", value: isUp ? "Positive" : "Negative", color: isUp ? C.green : C.red },
              { icon: <BarChart3 size={12} />, label: "Valuation", value: stock.pe < 8 ? "Deep Value" : stock.pe < 12 ? "Fair" : "Growth", color: stock.pe < 8 ? C.green : C.text },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textMuted }}>{icon} {label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 10, background: "rgba(34,211,238,0.05)", borderRadius: 8, border: `1px solid ${C.accentDim}` }}>
              <div style={{ fontSize: 9, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Summary</div>
              <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5 }}>
                {score >= 75 ? "Strong fundamentals with favorable risk/reward. Consider for core position." :
                 score >= 60 ? "Solid profile with moderate upside. Good for diversification." :
                 "Speculative — high potential but elevated risk. Size carefully."}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto" }}>
          {stockNews.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: C.textDim, fontSize: 12 }}>No recent news for {ticker}</div>
          ) : stockNews.map(n => {
            const scfg = SENTIMENT_CONFIG[n.sentiment];
            return (
              <div key={n.id} style={{
                background: scfg.bg, borderLeft: `3px solid ${scfg.color}`,
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>{n.headline}</div>
                <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5, marginBottom: 6 }}>{n.analysis}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 9, color: C.textDim }}>
                  <span>{n.source}</span>
                  <span style={{ color: scfg.color, fontWeight: 600 }}>Impact: {n.impactScore}/100</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Comparator() {
  const data = Object.entries(WATCHLIST_STOCKS).map(([t, s]) => ({
    ticker: t, score: computeScore(s),
    upside: parseFloat((((s.targetPrice - s.price) / s.price) * 100).toFixed(1)),
    pe: s.pe, dividendYield: s.dividendYield, roe: s.roe, beta: s.beta,
  })).sort((a, b) => b.score - a.score);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <BarChart3 size={14} color={C.accent} /> Comparison Rankings
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["#", "Stock", "Score", "Upside", "P/E", "Div %", "ROE", "Beta"].map(h => (
                <th key={h} style={{ padding: "7px 8px", textAlign: h === "Stock" ? "left" : "right", color: C.textDim, fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "7px 8px", textAlign: "right", color: C.textDim }}>{i + 1}</td>
                <td style={{ padding: "7px 8px", fontWeight: 700, color: C.text }}>{d.ticker}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d.score >= 75 ? C.green : d.score >= 60 ? C.amber : C.red }}>{d.score}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: C.green }}>{d.upside}%</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: d.pe < 8 ? C.green : C.text }}>{d.pe}x</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: d.dividendYield > 5 ? C.green : C.text }}>{d.dividendYield}%</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: d.roe > 20 ? C.green : C.text }}>{d.roe}%</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: d.beta < 1 ? C.green : d.beta > 1.3 ? C.red : C.amber }}>{d.beta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketOverview() {
  const SCOLORS = ["#22d3ee", "#3b82f6", "#10b981", "#a78bfa", "#f59e0b", "#64748b"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 5 }}>
            <Activity size={13} color={C.accent} /> KSE-100
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>154,292</span>
            <span style={{ fontSize: 11, color: C.green, marginLeft: 6 }}>+31% YoY</span>
          </div>
        </div>
        <div style={{ height: 70 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={KSE100_DATA}>
              <defs>
                <linearGradient id="kseG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} fill="url(#kseG)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: C.textDim }}>
          <span>SBP Rate: <b style={{ color: C.amber }}>10.5%</b></span>
          <span>CPI: <b style={{ color: C.green }}>~5%</b></span>
          <span>ATH: <b style={{ color: C.accent }}>189,556</b></span>
          <span>Brent: <b style={{ color: C.red }}>$85+</b></span>
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>Sector Weights & Returns</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 100, height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SECTOR_DATA} dataKey="weight" cx="50%" cy="50%" innerRadius={25} outerRadius={48} paddingAngle={2}>
                  {SECTOR_DATA.map((_, i) => <Cell key={i} fill={SCOLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            {SECTOR_DATA.map((s, i) => (
              <div key={s.sector} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.textMuted }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: SCOLORS[i], display: "inline-block" }} />
                  {s.sector}
                </span>
                <span>
                  <b style={{ color: C.text }}>{s.weight}%</b>
                  <span style={{ color: C.green, marginLeft: 6 }}>+{s.return1y}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PORTFOLIO PANEL (PRIVATE)
// ============================================================

function AddPositionModal({ onAdd, onClose, editPosition }) {
  const [ticker, setTicker] = useState(editPosition?.ticker || "");
  const [shares, setShares] = useState(editPosition?.shares || "");
  const [avgCost, setAvgCost] = useState(editPosition?.avgCost || "");
  const [targetSell, setTargetSell] = useState(editPosition?.targetSell || "");
  const [stopLoss, setStopLoss] = useState(editPosition?.stopLoss || "");
  const [notes, setNotes] = useState(editPosition?.notes || "");

  const tickers = Object.keys(WATCHLIST_STOCKS);
  const inputStyle = {
    width: "100%", padding: "8px 10px", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 24, width: 400, maxWidth: "90vw",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>
          {editPosition ? "Edit Position" : "Add Position"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Stock</label>
            <select value={ticker} onChange={e => setTicker(e.target.value)}
              disabled={!!editPosition}
              style={{ ...inputStyle, cursor: editPosition ? "not-allowed" : "pointer" }}>
              <option value="">Select...</option>
              {tickers.map(t => <option key={t} value={t}>{t} — {WATCHLIST_STOCKS[t].name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Shares</label>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              placeholder="e.g. 50" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Avg Cost (₨)</label>
            <input type="number" value={avgCost} onChange={e => setAvgCost(e.target.value)}
              placeholder="Buy price" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Target Sell (₨)</label>
            <input type="number" value={targetSell} onChange={e => setTargetSell(e.target.value)}
              placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Stop Loss (₨)</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              placeholder="Optional" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Why did you buy this?" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.textMuted, fontSize: 12, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => {
            if (!ticker || !shares || !avgCost) return;
            onAdd({
              ticker, shares: parseFloat(shares), avgCost: parseFloat(avgCost),
              targetSell: targetSell ? parseFloat(targetSell) : null,
              stopLoss: stopLoss ? parseFloat(stopLoss) : null,
              highSinceBuy: WATCHLIST_STOCKS[ticker]?.weekHigh52 || parseFloat(avgCost),
              notes, buyDate: editPosition?.buyDate || new Date().toISOString().split("T")[0],
            });
          }} style={{
            padding: "8px 20px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
            border: "none", borderRadius: 8, color: C.bg, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{editPosition ? "Update" : "Add Position"}</button>
        </div>
      </div>
    </div>
  );
}

function PortfolioPanel({ positions, setPositions, onStockSelect }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [monthlyAdvice, setMonthlyAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const fileInputRef = useRef(null);

  const summary = useMemo(() => calculatePortfolioSummary(positions), [positions]);

  const allSignals = useMemo(() => {
    if (positions.length === 0) return [];
    return positions.flatMap(pos => {
      const stock = WATCHLIST_STOCKS[pos.ticker];
      if (!stock) return [];
      return generateSellSignals(pos, stock, summary.totalValue || 1).map(s => ({ ...s, ticker: pos.ticker }));
    }).sort((a, b) => SIGNAL_TYPES[a.type].priority - SIGNAL_TYPES[b.type].priority);
  }, [positions, summary.totalValue]);

  // Auto-fetch monthly advice (cached 30 days)
  useEffect(() => {
    if (positions.length === 0) return;
    let cancelled = false;
    async function load() {
      setAdviceLoading(true);
      try {
        const advice = await getMonthlyAdvice(positions, 50000);
        if (!cancelled && advice) setMonthlyAdvice(advice);
      } catch (err) {
        console.error("Advice failed:", err);
      } finally {
        if (!cancelled) setAdviceLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [positions.length]); // only re-fetch if position count changes

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);

    try {
      // Read PDF as text using pdf.js
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Reconstruct lines by grouping items with similar Y positions
        const items = content.items.filter(item => item.str.trim());
        let lines = [];
        let currentLine = "";
        let lastY = null;
        for (const item of items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 3) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = "";
          }
          currentLine += item.str + " ";
          lastY = item.transform[5];
        }
        if (currentLine.trim()) lines.push(currentLine.trim());
        fullText += lines.join("\n") + "\n";
      }

      const result = parseFinqalabText(fullText);

      if (result.positions.length === 0) {
        setImportError("No positions found in PDF. Make sure it's a Finqalab Periodic Trade Details Report.");
      } else {
        setImportData(result);
        setShowImportModal(true);
      }
    } catch (err) {
      console.error("PDF parse error:", err);
      setImportError("Failed to parse PDF: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (!importData) return;
    setPositions(importData.positions);
    setShowImportModal(false);
    setImportData(null);
  };

  const handleAdd = (position) => {
    if (editingPosition) {
      setPositions(prev => prev.map(p => p.ticker === position.ticker ? position : p));
    } else {
      setPositions(prev => {
        const existing = prev.find(p => p.ticker === position.ticker);
        if (existing) {
          // Average in
          const totalShares = existing.shares + position.shares;
          const newAvgCost = (existing.shares * existing.avgCost + position.shares * position.avgCost) / totalShares;
          return prev.map(p => p.ticker === position.ticker ? { ...p, shares: totalShares, avgCost: Math.round(newAvgCost * 100) / 100 } : p);
        }
        return [...prev, position];
      });
    }
    setShowAddModal(false);
    setEditingPosition(null);
  };

  const handleRemove = (ticker) => {
    setPositions(prev => prev.filter(p => p.ticker !== ticker));
  };

  return (
    <div>
      {/* Portfolio Summary Card */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Portfolio Value</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>
              ₨{summary.totalValue.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Total P&L</div>
            <div style={{
              fontSize: 22, fontWeight: 800,
              color: summary.totalPnL >= 0 ? C.green : C.red,
            }}>
              {summary.totalPnL >= 0 ? "+" : ""}₨{summary.totalPnL.toLocaleString()}
              <span style={{ fontSize: 13, marginLeft: 4 }}>({summary.totalPnLPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <div>
            <span style={{ color: C.textDim }}>Cost Basis: </span>
            <b style={{ color: C.text }}>₨{summary.totalCost.toLocaleString()}</b>
          </div>
          <div>
            <span style={{ color: C.textDim }}>Today: </span>
            <b style={{ color: summary.totalDayChange >= 0 ? C.green : C.red }}>
              {summary.totalDayChange >= 0 ? "+" : ""}₨{summary.totalDayChange.toLocaleString()}
            </b>
          </div>
          <div>
            <span style={{ color: C.textDim }}>Positions: </span>
            <b style={{ color: C.text }}>{positions.length}</b>
          </div>
        </div>
      </div>

      {/* Sell Signals */}
      {allSignals.length > 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} color={C.amber} /> Active Signals ({allSignals.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {allSignals.map((sig, i) => {
              const cfg = SIGNAL_TYPES[sig.type];
              return (
                <div key={i} style={{
                  background: `${cfg.color}08`, borderLeft: `3px solid ${cfg.color}`,
                  borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                }} onClick={() => onStockSelect(sig.ticker)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>
                      {cfg.icon} {sig.ticker} — {cfg.label}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, color: cfg.color, textTransform: "uppercase",
                      background: `${cfg.color}15`, padding: "1px 5px", borderRadius: 3,
                    }}>{sig.urgency}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{sig.message}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{sig.action}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Allocation Advisor */}
      {positions.length > 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
              <DollarSign size={13} color={C.accent} /> Monthly Allocation Advisor
            </div>
            {monthlyAdvice?._cacheAge && (
              <span style={{ fontSize: 8, color: C.textDim }}>
                {monthlyAdvice._fromCache ? `Updated ${monthlyAdvice._cacheAge}` : "Fresh analysis"}
              </span>
            )}
          </div>

          {adviceLoading && (
            <div style={{ padding: 20, textAlign: "center" }}>
              <Loader size={18} color={C.accent} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
              <div style={{ fontSize: 11, color: C.textMuted }}>Analyzing market conditions and your portfolio...</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>Searching PSX data, macro outlook, sector trends</div>
            </div>
          )}

          {monthlyAdvice && !adviceLoading && (
            <div>
              {/* Market condition badge */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 4,
                  color: monthlyAdvice.marketCondition === "bullish" ? C.green : monthlyAdvice.marketCondition === "bearish" ? C.red : C.amber,
                  background: monthlyAdvice.marketCondition === "bullish" ? "rgba(16,185,129,0.12)" : monthlyAdvice.marketCondition === "bearish" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                }}>Market: {monthlyAdvice.marketCondition}</span>
              </div>

              {/* Summary */}
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6, marginBottom: 12, padding: "8px 10px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                {monthlyAdvice.summary}
              </div>

              {/* Allocations */}
              {monthlyAdvice.allocations?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Recommended Allocation</div>
                  {monthlyAdvice.allocations.map((a, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 10px", marginBottom: 4, background: "rgba(16,185,129,0.06)",
                      borderRadius: 6, borderLeft: `3px solid ${C.green}`,
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{a.ticker}</span>
                        <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>{a.reason}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>₨{a.amount?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rotations */}
              {monthlyAdvice.rotations?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Suggested Rotations</div>
                  {monthlyAdvice.rotations.map((r, i) => (
                    <div key={i} style={{
                      padding: "6px 10px", marginBottom: 4, background: "rgba(34,211,238,0.06)",
                      borderRadius: 6, borderLeft: `3px solid ${C.accent}`,
                      fontSize: 11, color: C.textMuted,
                    }}>
                      <span style={{ color: C.red, fontWeight: 600 }}>Sell {r.sell}</span>
                      <span style={{ margin: "0 6px" }}>→</span>
                      <span style={{ color: C.green, fontWeight: 600 }}>Buy {r.buy}</span>
                      <span style={{ marginLeft: 8, fontSize: 10 }}>{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Hold cash */}
              {monthlyAdvice.holdCash?.amount > 0 && (
                <div style={{
                  padding: "6px 10px", marginBottom: 10, background: "rgba(245,158,11,0.06)",
                  borderRadius: 6, borderLeft: `3px solid ${C.amber}`, fontSize: 11, color: C.textMuted,
                }}>
                  <span style={{ fontWeight: 600, color: C.amber }}>Hold ₨{monthlyAdvice.holdCash.amount.toLocaleString()} cash</span>
                  <span style={{ marginLeft: 8 }}>{monthlyAdvice.holdCash.reason}</span>
                </div>
              )}

              {/* Key risk */}
              {monthlyAdvice.keyRisk && (
                <div style={{
                  padding: "6px 10px", background: "rgba(239,68,68,0.06)",
                  borderRadius: 6, borderLeft: `3px solid ${C.red}`, fontSize: 10, color: C.red,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <AlertTriangle size={11} /> {monthlyAdvice.keyRisk}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Positions Table */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Your Positions</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileSelect}
              style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={{
              padding: "5px 12px", background: "transparent", border: `1px solid ${C.accent}`,
              borderRadius: 6, color: C.accent, fontSize: 10, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, opacity: importing ? 0.5 : 1,
            }}>
              <Upload size={11} /> {importing ? "Parsing..." : "Import Finqalab PDF"}
            </button>
            <button onClick={() => { setEditingPosition(null); setShowAddModal(true); }} style={{
              padding: "5px 12px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              border: "none", borderRadius: 6, color: C.bg, fontSize: 10, fontWeight: 700, cursor: "pointer",
            }}>+ Add Position</button>
          </div>
        </div>

        {importError && (
          <div style={{
            padding: "8px 12px", marginBottom: 10, background: "rgba(239,68,68,0.08)",
            border: `1px solid ${C.redDim}`, borderRadius: 6, fontSize: 10, color: C.red,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle size={12} /> {importError}
            <button onClick={() => setImportError(null)} style={{
              marginLeft: "auto", background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12,
            }}>×</button>
          </div>
        )}

        {positions.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>No positions yet</div>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 12 }}>Import your Finqalab PDF or add positions manually</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => fileInputRef.current?.click()} style={{
                padding: "8px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
                border: "none", borderRadius: 8, color: C.bg, fontSize: 11, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Upload size={12} /> Import Finqalab PDF
              </button>
              <button onClick={() => {
                setPositions(SAMPLE_PORTFOLIO);
              }} style={{
                padding: "8px 16px", background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.textDim, fontSize: 11, cursor: "pointer",
              }}>Load Sample</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summary.positions.map(pos => {
              const stock = WATCHLIST_STOCKS[pos.ticker];
              const posSignals = allSignals.filter(s => s.ticker === pos.ticker);
              const weight = summary.totalValue > 0 ? (pos.currentValue / summary.totalValue * 100) : 0;
              const originalPos = positions.find(p => p.ticker === pos.ticker);

              return (
                <div key={pos.ticker} style={{
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
                  borderLeft: posSignals.length > 0 ? `3px solid ${posSignals[0].type === "STOP_LOSS" ? C.red : C.amber}` : `3px solid ${C.border}`,
                }} onClick={() => onStockSelect(pos.ticker)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{pos.ticker}</span>
                        <span style={{ fontSize: 10, color: C.textDim }}>{pos.shares} shares</span>
                        {posSignals.length > 0 && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, color: C.amber,
                            background: "rgba(245,158,11,0.12)", padding: "1px 5px", borderRadius: 3,
                          }}>{posSignals.length} signal{posSignals.length > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                        Avg ₨{pos.avgCost} → ₨{pos.currentPrice}
                        {originalPos?.notes && <span style={{ marginLeft: 6, fontStyle: "italic" }}>"{originalPos.notes}"</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: pos.unrealizedPnL >= 0 ? C.green : C.red }}>
                        {pos.unrealizedPnL >= 0 ? "+" : ""}₨{pos.unrealizedPnL.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: pos.unrealizedPnLPct >= 0 ? C.green : C.red }}>
                        {pos.unrealizedPnLPct >= 0 ? "+" : ""}{pos.unrealizedPnLPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Position bar */}
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, position: "relative" }}>
                      {pos.ticker && originalPos?.stopLoss && (
                        <div style={{
                          position: "absolute", height: 10, width: 2, background: C.red, top: -3,
                          left: `${Math.max(0, Math.min(100, ((originalPos.stopLoss - stock.weekLow52) / (stock.weekHigh52 - stock.weekLow52)) * 100))}%`,
                        }} title={`Stop: ₨${originalPos.stopLoss}`} />
                      )}
                      <div style={{
                        position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 2,
                        width: `${Math.min(100, ((pos.currentPrice - stock.weekLow52) / (stock.weekHigh52 - stock.weekLow52)) * 100)}%`,
                        background: pos.unrealizedPnL >= 0 ? C.green : C.red,
                      }} />
                      {originalPos?.targetSell && (
                        <div style={{
                          position: "absolute", height: 10, width: 2, background: C.accent, top: -3,
                          left: `${Math.min(100, ((originalPos.targetSell - stock.weekLow52) / (stock.weekHigh52 - stock.weekLow52)) * 100)}%`,
                        }} title={`Target: ₨${originalPos.targetSell}`} />
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: C.textDim, minWidth: 40 }}>{weight.toFixed(1)}%</span>
                  </div>

                  {/* Quick actions */}
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPosition(originalPos); setShowAddModal(true); }} style={{
                      padding: "3px 8px", background: "transparent", border: `1px solid ${C.border}`,
                      borderRadius: 4, color: C.textDim, fontSize: 9, cursor: "pointer",
                    }}>Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleRemove(pos.ticker); }} style={{
                      padding: "3px 8px", background: "transparent", border: `1px solid ${C.redDim}`,
                      borderRadius: 4, color: C.red, fontSize: 9, cursor: "pointer",
                    }}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPositionModal
          onAdd={handleAdd}
          onClose={() => { setShowAddModal(false); setEditingPosition(null); }}
          editPosition={editingPosition}
        />
      )}

      {/* Finqalab Import Preview Modal */}
      {showImportModal && importData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, backdropFilter: "blur(4px)",
        }} onClick={() => setShowImportModal(false)}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: 24, width: 560, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <FileText size={18} color={C.accent} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Finqalab Import Preview</div>
                <div style={{ fontSize: 11, color: C.textDim }}>
                  {importData.meta.clientName} · {importData.meta.period} · {importData.trades.length} trades
                </div>
              </div>
            </div>

            {/* Positions preview table */}
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Ticker", "Shares", "Avg Cost", "Total", "Trades", "In Watchlist"].map(h => (
                      <th key={h} style={{
                        padding: "6px 8px", textAlign: h === "Ticker" ? "left" : "right",
                        color: C.textDim, fontWeight: 600, fontSize: 9, textTransform: "uppercase",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importData.positions.map(pos => {
                    const inWatchlist = !!WATCHLIST_STOCKS[pos.ticker];
                    return (
                      <tr key={pos.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700, color: C.text }}>{pos.ticker}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: C.text }}>{pos.shares}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: C.text }}>₨{pos.avgCost}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: C.text }}>₨{pos.totalInvested.toLocaleString()}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: C.textDim }}>{pos.tradeCount}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          {inWatchlist ? (
                            <Check size={12} color={C.green} />
                          ) : (
                            <span style={{ fontSize: 9, color: C.amber }}>Not tracked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{
              padding: "10px 12px", background: C.bg, borderRadius: 8, marginBottom: 16,
              border: `1px solid ${C.border}`, fontSize: 11,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: C.textDim }}>Total Positions</span>
                <b style={{ color: C.text }}>{importData.positions.length}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: C.textDim }}>Total Invested</span>
                <b style={{ color: C.text }}>₨{importData.positions.reduce((s, p) => s + p.totalInvested, 0).toLocaleString()}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: C.textDim }}>Broker Fees</span>
                <b style={{ color: C.amber }}>₨{importData.positions.reduce((s, p) => s + p.brokerFees, 0).toFixed(2)}</b>
              </div>
              {importData.positions.some(p => !WATCHLIST_STOCKS[p.ticker]) && (
                <div style={{
                  marginTop: 8, padding: "6px 8px", background: "rgba(245,158,11,0.08)",
                  borderRadius: 4, fontSize: 10, color: C.amber,
                }}>
                  <AlertTriangle size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Some tickers aren't in the watchlist yet. They'll be imported but won't show P&L until added to stock data.
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowImportModal(false); setImportData(null); }} style={{
                padding: "8px 16px", background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.textMuted, fontSize: 12, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleConfirmImport} style={{
                padding: "8px 20px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
                border: "none", borderRadius: 8, color: C.bg, fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Check size={14} /> Import {importData.positions.length} Positions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [selectedStock, setSelectedStock] = useState("PSO");
  const [filter, setFilter] = useState("all");
  const [activePanel, setActivePanel] = useState("news");
  const [view, setView] = useState("dashboard");
  const [positions, setPositions] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authMode, setAuthMode] = useState("signin"); // "signin" or "signup"

  // Check auth on mount and load positions from Supabase
  useEffect(() => {
    async function init() {
      const { getSession, onAuthStateChange } = await import("./supabase.js");
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        const { loadPositions } = await import("./supabase.js");
        const pos = await loadPositions();
        setPositions(pos);
      }
      setAuthLoading(false);

      // Listen for auth changes
      onAuthStateChange(async (u) => {
        setUser(u);
        if (u) {
          const { loadPositions } = await import("./supabase.js");
          const pos = await loadPositions();
          setPositions(pos);
        } else {
          setPositions([]);
        }
      });
    }
    init();
  }, []);

  // Save positions to Supabase whenever they change
  useEffect(() => {
    if (!user || positions.length === 0) return;
    const save = async () => {
      const { savePositions } = await import("./supabase.js");
      await savePositions(positions);
    };
    save();
  }, [positions, user]);

  const handleAuth = async () => {
    setAuthError(null);
    const { signIn, signUp } = await import("./supabase.js");
    const { data, error } = authMode === "signin"
      ? await signIn(authEmail, authPassword)
      : await signUp(authEmail, authPassword);
    if (error) {
      setAuthError(error.message || String(error));
    } else {
      setShowAuth(false);
      setUser(data?.user || null);
    }
  };

  const handleSignOut = async () => {
    const { signOut } = await import("./supabase.js");
    await signOut();
    setUser(null);
    setPositions([]);
  };

  const allSignals = useMemo(() => {
    if (positions.length === 0) return [];
    const summary = calculatePortfolioSummary(positions);
    return positions.flatMap(pos => {
      const stock = WATCHLIST_STOCKS[pos.ticker];
      if (!stock) return [];
      return generateSellSignals(pos, stock, summary.totalValue || 1).map(s => ({ ...s, ticker: pos.ticker }));
    });
  }, [positions]);

  const urgentSignals = allSignals.filter(s => s.urgency === "immediate");

  const filteredStocks = useMemo(() => {
    return Object.entries(WATCHLIST_STOCKS).filter(([_, s]) => {
      if (filter === "shariah") return s.shariah;
      if (filter === "banking") return s.sector.includes("Banking");
      if (filter === "energy") return s.sector === "Energy";
      if (filter === "highscore") return computeScore(s) >= 70;
      return true;
    });
  }, [filter]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', 'JetBrains Mono', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: C.bg,
          }}>P</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}>PSX MONITOR</div>
            <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 1 }}>PAKISTAN STOCK EXCHANGE · INTELLIGENCE DASHBOARD</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: C.textDim }}>
          {/* View tabs */}
          <div style={{ display: "flex", gap: 0, background: C.bg, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, marginRight: 12 }}>
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "portfolio", label: "My Portfolio" },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: "6px 14px", background: view === v.id ? C.card : "transparent",
                border: "none", color: view === v.id ? C.accent : C.textDim,
                fontSize: 11, fontWeight: 600, cursor: "pointer", position: "relative",
              }}>
                {v.label}
                {v.id === "portfolio" && urgentSignals.length > 0 && (
                  <span style={{
                    position: "absolute", top: 2, right: 2, width: 8, height: 8,
                    borderRadius: "50%", background: C.red, animation: "pulse 2s infinite",
                  }} />
                )}
              </button>
            ))}
          </div>
          <Clock size={11} /> Data as of March 2026
          {user ? (
            <span style={{ fontSize: 9, color: C.textDim, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.green }}>●</span> {user.email?.split("@")[0]}
              <button onClick={handleSignOut} style={{
                background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4,
                color: C.textDim, fontSize: 8, padding: "2px 6px", cursor: "pointer",
              }}>Sign Out</button>
            </span>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`, border: "none",
              borderRadius: 6, color: C.bg, fontSize: 9, fontWeight: 700, padding: "4px 10px", cursor: "pointer",
            }}>Sign In</button>
          )}
          <span style={{ background: "rgba(16,185,129,0.12)", color: C.green, padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600, marginLeft: 6 }}>● LIVE</span>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, backdropFilter: "blur(4px)",
        }} onClick={() => setShowAuth(false)}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: 24, width: 360, maxWidth: "90vw",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {authMode === "signin" ? "Sign In" : "Create Account"}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 16 }}>
              Your portfolio data syncs across devices securely.
            </div>
            {authError && (
              <div style={{ padding: "6px 10px", marginBottom: 10, background: "rgba(239,68,68,0.08)", borderRadius: 6, fontSize: 10, color: C.red }}>
                {authError}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAuth()}
                style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <button onClick={handleAuth} style={{
              width: "100%", padding: "10px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              border: "none", borderRadius: 8, color: C.bg, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10,
            }}>{authMode === "signin" ? "Sign In" : "Create Account"}</button>
            <div style={{ textAlign: "center", fontSize: 11, color: C.textDim }}>
              {authMode === "signin" ? "Don't have an account?" : "Already have an account?"}
              <button onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")} style={{
                background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, marginLeft: 4,
              }}>{authMode === "signin" ? "Sign Up" : "Sign In"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 20px" }}>
        {view === "dashboard" ? (
          <>
        <MarketOverview />

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All" },
            { id: "shariah", label: "☪ Shariah" },
            { id: "banking", label: "Banking" },
            { id: "energy", label: "Energy" },
            { id: "highscore", label: "⚡ High Score" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? "rgba(34,211,238,0.12)" : "transparent",
              border: `1px solid ${filter === f.id ? C.accent : C.border}`,
              color: filter === f.id ? C.accent : C.textDim,
              padding: "5px 12px", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Main 3-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 14 }}>
          {/* Stock cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 580, overflowY: "auto", paddingRight: 4 }}>
            {filteredStocks.map(([ticker, stock]) => (
              <StockCard key={ticker} ticker={ticker} stock={stock}
                isSelected={selectedStock === ticker}
                onClick={() => setSelectedStock(ticker)} />
            ))}
          </div>

          {/* Detail panel */}
          <DetailPanel ticker={selectedStock} stock={WATCHLIST_STOCKS[selectedStock]} />

          {/* Right panel: News + Macro */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 0, background: C.card, borderRadius: "8px 8px 0 0", overflow: "hidden", border: `1px solid ${C.border}`, borderBottom: "none" }}>
              {[
                { id: "news", label: "News Feed", icon: <Newspaper size={11} /> },
                { id: "macro", label: "Macro Risks", icon: <Globe size={11} /> },
              ].map(p => (
                <button key={p.id} onClick={() => setActivePanel(p.id)} style={{
                  flex: 1, background: activePanel === p.id ? C.card : C.bg,
                  border: "none", color: activePanel === p.id ? C.accent : C.textDim,
                  padding: "8px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>{p.icon} {p.label}</button>
              ))}
            </div>
            {activePanel === "news" ? (
              <NewsFeedPanel selectedStock={selectedStock} />
            ) : (
              <MacroFactorsPanel />
            )}
          </div>
        </div>

        {/* Comparison */}
        <div style={{ marginTop: 14 }}>
          <Comparator />
        </div>
          </>
        ) : (
          /* PORTFOLIO VIEW — requires auth */
          !user ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Lock size={32} color={C.textDim} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Sign in to access your portfolio</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Your positions, signals, and advice are stored securely in Supabase.</div>
              <button onClick={() => setShowAuth(true)} style={{
                padding: "10px 24px", background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
                border: "none", borderRadius: 8, color: C.bg, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Sign In / Create Account</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
              <PortfolioPanel
                positions={positions}
                setPositions={setPositions}
                onStockSelect={(t) => { setSelectedStock(t); setView("dashboard"); }}
              />
              <div>
                <DetailPanel ticker={selectedStock} stock={WATCHLIST_STOCKS[selectedStock]} />
              </div>
            </div>
          )
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 14, padding: 10, background: "rgba(245,158,11,0.06)",
          border: `1px solid rgba(245,158,11,0.15)`, borderRadius: 8,
          fontSize: 9, color: C.textDim, lineHeight: 1.5,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <AlertTriangle size={13} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <b style={{ color: C.amber }}>Disclaimer:</b> For informational purposes only — not financial advice.
            Portfolio data is stored locally in your browser only — never sent to any server.
            Data reflects analyst estimates as of mid-March 2026. Always consult a SECP-registered broker before investing.
          </span>
        </div>
      </div>
    </div>
  );
}
