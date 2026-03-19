-- ============================================================
-- PSX Monitor — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Positions table (current holdings)
CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  shares NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  total_invested NUMERIC DEFAULT 0,
  target_sell NUMERIC,
  stop_loss NUMERIC,
  high_since_buy NUMERIC,
  notes TEXT DEFAULT '',
  buy_date DATE,
  broker_fees NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, ticker)
);

-- 2. Transactions table (individual trade records from Finqalab)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  trade_no TEXT NOT NULL,
  trade_date DATE NOT NULL,
  settlement_date DATE,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  rate NUMERIC NOT NULL,
  qty INTEGER NOT NULL,
  total NUMERIC NOT NULL,
  broker_rate NUMERIC,
  broker_total NUMERIC,
  cvt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, trade_no)
);

-- 3. Import logs (track PDF uploads)
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT,
  period TEXT,
  trade_count INTEGER,
  position_count INTEGER,
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Auto-update updated_at on positions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. Row Level Security (RLS) — users only see their own data
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Positions policies
CREATE POLICY "Users can view own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON positions FOR DELETE
  USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Import logs policies
CREATE POLICY "Users can view own import logs"
  ON import_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import logs"
  ON import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, trade_date);
