import type { TradeLog, ScoutLogEntry } from "./types";
import { apiFetch } from "./supabase";

export async function fetchTradeLogs(): Promise<TradeLog[]> {
  const res = await apiFetch("/results?limit=50");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchScoutHistory(): Promise<ScoutLogEntry[]> {
  const res = await apiFetch("/scout-history");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCreditBalance(): Promise<{ balance: number; transactions: unknown[] }> {
  const res = await apiFetch("/credits");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createCheckoutSession(type: "subscription" | "credits", tier?: string): Promise<string> {
  const path = type === "subscription" ? `/checkout/subscription/${tier ?? "pro"}` : "/checkout/credits";
  const res = await apiFetch(path, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.url;
}

export async function createBillingPortal(): Promise<string> {
  const returnUrl = encodeURIComponent(`${window.location.origin}/settings`);
  const res = await apiFetch(`/billing/portal?return_url=${returnUrl}`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.url;
}

export async function saveAlpacaKeys(apiKey: string, apiSecret: string, paper: boolean): Promise<void> {
  const res = await apiFetch("/settings/alpaca", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, paper }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
