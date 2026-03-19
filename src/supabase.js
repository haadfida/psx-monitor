// Supabase Client — single source of truth for all data
// No localStorage fallback. Supabase or nothing.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("PSX Monitor: Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================
// AUTH — email/password (simple, no Google OAuth needed)
// ============================================================

export async function signUp(email, password) {
  if (!supabase) return { error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  if (!supabase) return { error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// ============================================================
// POSITIONS
// ============================================================

export async function loadPositions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("ticker");
  if (error) { console.error("Load positions failed:", error); return []; }
  // Map DB columns to app format
  return (data || []).map(row => ({
    ticker: row.ticker,
    shares: parseFloat(row.shares),
    avgCost: parseFloat(row.avg_cost),
    totalInvested: parseFloat(row.total_invested || 0),
    targetSell: row.target_sell ? parseFloat(row.target_sell) : null,
    stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
    highSinceBuy: row.high_since_buy ? parseFloat(row.high_since_buy) : null,
    notes: row.notes || "",
    buyDate: row.buy_date,
    brokerFees: parseFloat(row.broker_fees || 0),
  }));
}

export async function savePositions(positions) {
  if (!supabase) return { error: "Supabase not configured" };
  const user = await getUser();
  if (!user) return { error: "Not logged in" };

  const rows = positions.map(p => ({
    user_id: user.id,
    ticker: p.ticker,
    shares: p.shares,
    avg_cost: p.avgCost,
    total_invested: p.totalInvested || p.shares * p.avgCost,
    target_sell: p.targetSell,
    stop_loss: p.stopLoss,
    high_since_buy: p.highSinceBuy,
    notes: p.notes || "",
    buy_date: p.buyDate || null,
    broker_fees: p.brokerFees || 0,
  }));

  // Upsert to avoid 409 conflicts from race conditions
  const { error } = await supabase
    .from("positions")
    .upsert(rows, { onConflict: "user_id,ticker" });
  if (error) console.error("Save positions failed:", error);
  return { success: !error, error };
}

export async function deletePosition(ticker) {
  if (!supabase) return { error: "Supabase not configured" };
  const user = await getUser();
  if (!user) return { error: "Not logged in" };
  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("user_id", user.id)
    .eq("ticker", ticker);
  return { success: !error, error };
}

// ============================================================
// TRANSACTIONS
// ============================================================

export async function saveTransactions(trades) {
  if (!supabase) return { error: "Supabase not configured" };
  const user = await getUser();
  if (!user) return { error: "Not logged in" };

  const rows = trades.map(t => ({
    user_id: user.id,
    ticker: t.ticker,
    trade_no: t.tradeNo,
    trade_date: t.tradeDate,
    settlement_date: t.settlementDate,
    type: t.type,
    rate: t.rate,
    qty: t.qty,
    total: t.total,
    broker_rate: t.brokerRate,
    broker_total: t.brokerTotal,
    cvt: t.cvt,
  }));

  const { data, error } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "user_id,trade_no" });
  if (error) console.error("Save transactions failed:", error);
  return { success: !error, error };
}

// ============================================================
// NEWS CACHE
// ============================================================

export async function getNewsCache() {
  if (!supabase) return null;
  const user = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("news_cache")
    .select("*")
    .eq("user_id", user.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  const ageHours = (Date.now() - new Date(data.fetched_at).getTime()) / 3600000;
  return { analysis: data.analysis, fetchedAt: data.fetched_at, ageHours, isStale: ageHours > 24 };
}

export async function saveNewsCache(analysis, tickers) {
  if (!supabase) return;
  const user = await getUser();
  if (!user) return;

  await supabase.from("news_cache").delete().eq("user_id", user.id);
  await supabase.from("news_cache").insert({
    user_id: user.id, analysis, tickers, fetched_at: new Date().toISOString(),
  });
}

// ============================================================
// ADVICE CACHE
// ============================================================

export async function getAdviceCache() {
  if (!supabase) return null;
  const user = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("advice_cache")
    .select("*")
    .eq("user_id", user.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  const ageDays = (Date.now() - new Date(data.fetched_at).getTime()) / 86400000;
  return { advice: data.advice, fetchedAt: data.fetched_at, ageDays, isStale: ageDays > 30 };
}

export async function saveAdviceCache(advice) {
  if (!supabase) return;
  const user = await getUser();
  if (!user) return;

  await supabase.from("advice_cache").delete().eq("user_id", user.id);
  await supabase.from("advice_cache").insert({
    user_id: user.id, advice, fetched_at: new Date().toISOString(),
  });
}

// ============================================================
// IMPORT LOG
// ============================================================

export async function saveImportLog(meta, tradeCount, positionCount) {
  if (!supabase) return;
  const user = await getUser();
  if (!user) return;

  await supabase.from("import_logs").insert({
    user_id: user.id,
    client_name: meta.clientName,
    period: meta.period,
    trade_count: tradeCount,
    position_count: positionCount,
  });
}
