// Supabase Client & Database Module
// Handles auth, position storage, and transaction history

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================
// AUTH
// ============================================================

export async function signInWithGoogle() {
  if (!supabase) return { error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
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

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// ============================================================
// POSITIONS CRUD
// ============================================================

export async function loadPositions() {
  if (!supabase) {
    // Fallback to localStorage
    try {
      return JSON.parse(localStorage.getItem("psx_positions") || "[]");
    } catch { return []; }
  }

  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("ticker");

  if (error) {
    console.error("Failed to load positions:", error);
    return [];
  }
  return data;
}

export async function savePositions(positions) {
  if (!supabase) {
    localStorage.setItem("psx_positions", JSON.stringify(positions));
    return { success: true };
  }

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  // Upsert all positions (insert or update by user_id + ticker)
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

  const { error } = await supabase
    .from("positions")
    .upsert(rows, { onConflict: "user_id,ticker" });

  if (error) console.error("Failed to save positions:", error);
  return { success: !error, error };
}

export async function deletePosition(ticker) {
  if (!supabase) {
    const current = JSON.parse(localStorage.getItem("psx_positions") || "[]");
    localStorage.setItem("psx_positions", JSON.stringify(current.filter(p => p.ticker !== ticker)));
    return { success: true };
  }

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("user_id", user.id)
    .eq("ticker", ticker);

  return { success: !error, error };
}

// ============================================================
// TRANSACTIONS (trade history from Finqalab imports)
// ============================================================

export async function saveTransactions(trades) {
  if (!supabase) {
    const existing = JSON.parse(localStorage.getItem("psx_transactions") || "[]");
    // Dedupe by tradeNo
    const existingIds = new Set(existing.map(t => t.tradeNo));
    const newTrades = trades.filter(t => !existingIds.has(t.tradeNo));
    localStorage.setItem("psx_transactions", JSON.stringify([...existing, ...newTrades]));
    return { added: newTrades.length };
  }

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

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

  // Use trade_no as unique constraint to avoid duplicates on re-import
  const { data, error } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "user_id,trade_no" });

  if (error) console.error("Failed to save transactions:", error);
  return { success: !error, error };
}

export async function loadTransactions() {
  if (!supabase) {
    try {
      return JSON.parse(localStorage.getItem("psx_transactions") || "[]");
    } catch { return []; }
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: false });

  if (error) {
    console.error("Failed to load transactions:", error);
    return [];
  }
  return data;
}

// ============================================================
// IMPORT LOG (track when PDFs were imported)
// ============================================================

export async function saveImportLog(meta, tradeCount, positionCount) {
  if (!supabase) {
    const logs = JSON.parse(localStorage.getItem("psx_import_logs") || "[]");
    logs.push({ ...meta, tradeCount, positionCount, importedAt: new Date().toISOString() });
    localStorage.setItem("psx_import_logs", JSON.stringify(logs));
    return;
  }

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
