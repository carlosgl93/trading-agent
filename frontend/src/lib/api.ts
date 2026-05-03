import type { TradeLog, ScoutLogEntry } from "./types";
import { BACKEND_URL } from "./types";

export async function fetchTradeLogs(): Promise<TradeLog[]> {
  const res = await fetch(`${BACKEND_URL}/results?limit=50`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchScoutHistory(): Promise<ScoutLogEntry[]> {
  const res = await fetch(`${BACKEND_URL}/scout-history`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
