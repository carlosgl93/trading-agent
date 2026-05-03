export interface TradeLog {
  id: string;
  ticker: string;
  analysis_date: string;
  rating: string | null;
  model_used: string;
  alpaca_order_id: string | null;
  execution_status: string;
  created_at: string;
}

export interface TradeLogDetail extends TradeLog {
  reasoning: string | null;
  raw_report: Record<string, unknown> | null;
}

export interface PortfolioPosition {
  id: string;
  ticker: string;
  direction: string;
  entry_rating: string;
  entry_date: string;
  entry_order_id: string | null;
  exit_order_id: string | null;
  exit_date: string | null;
  exit_rating: string | null;
  status: string;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface HealthStatus {
  status: string;
}

export interface TaskQueued {
  task_id: string;
  ticker: string;
  analysis_date: string;
  paid: boolean;
  status: string;
}

export interface SequenceQueued {
  chain_id: string;
  tickers: string[];
  analysis_date: string;
  paid: boolean;
  status: string;
}

export interface AnalysisInput {
  ticker: string;
  paid?: boolean;
}

export interface ScoutedTicker {
  ticker: string;
  sector: string;
  thesis: string;
  conviction: number;
}

export interface ScoutLogEntry {
  id: string;
  scout_date: string;
  macro_context: string | null;
  tickers_json: ScoutedTicker[];
  model_used: string;
  created_at: string;
}

export interface TradeOrderInput {
  ticker: string;
  side: "buy" | "sell" | "close";
  notional?: number;
}

export interface TradeOrderResult {
  order_id: string | null;
  ticker: string;
  side: string;
  notional: number | null;
  alpaca_status: string;
}

export const SCOUT_SECTORS = [
  "Technology", "Financials", "Healthcare", "Energy", "Industrials",
  "Consumer Discretionary", "Communication Services", "Utilities",
  "Materials", "Real Estate", "Consumer Staples",
] as const;

export type ScoutRiskLevel = "conservative" | "moderate" | "aggressive";
export type ScoutTimeHorizon = "short" | "medium" | "long";
export type ScoutStyle = "any" | "growth" | "value" | "momentum" | "quality";

export interface ScoutInput {
  paid?: boolean;
  max_picks?: number;
  min_conviction?: number;
  risk_level?: ScoutRiskLevel;
  focus_sectors?: string[];
  time_horizon?: ScoutTimeHorizon;
  style?: ScoutStyle;
}

export interface ScoutDispatched {
  task_id: string;
  paid: boolean;
  max_picks: number;
  min_conviction: number;
  status: string;
}

export const STATUS_COLORS: Record<string, string> = {
  executed: "#4ade80",
  skipped: "#64748b",
  failed: "#f87171",
  pending: "#fbbf24",
};

export const RATING_COLORS: Record<string, string> = {
  Buy: "#4ade80",
  Overweight: "#86efac",
  Hold: "#94a3b8",
  Underweight: "#fca5a5",
  Sell: "#f87171",
};

export const MODEL_LADDER = ["Gemma 4", "Minimax", "Nemotron", "DeepSeek"];

export const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8000";
