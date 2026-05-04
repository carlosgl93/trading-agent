import { useEffect } from "preact/hooks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/preact-query";
import type { TradeLog, TradeLogDetail, PortfolioPosition, HealthStatus, AnalysisInput, TaskQueued, SequenceQueued, ScoutLogEntry, ScoutInput, ScoutDispatched, TradeOrderInput, TradeOrderResult } from "../types";
import { BACKEND_URL } from "../types";
import { apiFetch } from "../supabase";
import { playNotification } from "../notify";
import { lastEvent, wsStatus } from "../ws";

async function fetchTradeLogs(): Promise<TradeLog[]> {
  const res = await apiFetch("/results?limit=50");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPositions(): Promise<PortfolioPosition[]> {
  const res = await apiFetch("/positions");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchScoutHistory(): Promise<ScoutLogEntry[]> {
  const res = await apiFetch("/scout-history");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useTradeLogDetail(id: string | null) {
  return useQuery<TradeLogDetail, Error>({
    queryKey: ["trade-log-detail", id],
    queryFn: async () => {
      const res = await apiFetch(`/results/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useTradeLogs() {
  return useQuery<TradeLog[], Error>({
    queryKey: ["trade-logs"],
    queryFn: fetchTradeLogs,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function usePositions() {
  return useQuery<PortfolioPosition[], Error>({
    queryKey: ["positions"],
    queryFn: fetchPositions,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useHealth() {
  return useQuery<HealthStatus, Error>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}

export function useScoutHistory() {
  return useQuery<ScoutLogEntry[], Error>({
    queryKey: ["scout-history"],
    queryFn: fetchScoutHistory,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

export class WashTradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WashTradeError";
  }
}

export function useTradeMutation() {
  return useMutation<TradeOrderResult, Error, TradeOrderInput>({
    mutationFn: async (input) => {
      const params = new URLSearchParams({ side: input.side });
      if (input.side !== "close" && input.notional !== undefined) {
        params.set("notional", String(input.notional));
      }
      const res = await apiFetch(`/trade/${input.ticker}?${params}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new WashTradeError(body.detail ?? `HTTP 409`);
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
  });
}

export function useScoutMutation() {
  const queryClient = useQueryClient();
  return useMutation<ScoutDispatched, Error, ScoutInput>({
    mutationFn: async (input) => {
      const params = new URLSearchParams();
      if (input.paid !== undefined) params.set("paid", String(input.paid));
      if (input.max_picks !== undefined) params.set("max_picks", String(input.max_picks));
      if (input.min_conviction !== undefined) params.set("min_conviction", String(input.min_conviction));
      if (input.risk_level) params.set("risk_level", input.risk_level);
      if (input.time_horizon) params.set("time_horizon", input.time_horizon);
      if (input.style) params.set("style", input.style);
      input.focus_sectors?.forEach((s) => params.append("focus_sectors", s));
      const res = await apiFetch(`/scout?${params}`, { method: "POST" });
      if (res.status === 402) throw new Error("INSUFFICIENT_CREDITS");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scout-history"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}

export function useAnalysisMutation() {
  const queryClient = useQueryClient();

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
    queryClient.invalidateQueries({ queryKey: ["credits"] });
  };

  const singleMutation = useMutation<TaskQueued, Error, AnalysisInput>({
    mutationFn: async (input) => {
      const res = await apiFetch(`/test-task/${input.ticker}?paid=${input.paid ?? false}`, {
        method: "POST",
      });
      if (res.status === 402) throw new Error("INSUFFICIENT_CREDITS");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess,
  });

  const sequenceMutation = useMutation<SequenceQueued, Error, { tickers: string[]; paid?: boolean }>({
    mutationFn: async (input) => {
      const res = await apiFetch(`/run-sequence?paid=${input.paid ?? false}`, {
        method: "POST",
        body: JSON.stringify(input.tickers),
      });
      if (res.status === 402) throw new Error("INSUFFICIENT_CREDITS");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess,
  });

  return { singleMutation, sequenceMutation };
}

export function useTaskEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = lastEvent.subscribe((event) => {
      if (!event || event.type !== "task_complete") return;

      switch (event.kind) {
        case "analysis":
        case "sequence":
          queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
          queryClient.invalidateQueries({ queryKey: ["credits"] });
          break;
        case "scout":
          queryClient.invalidateQueries({ queryKey: ["scout-history"] });
          queryClient.invalidateQueries({ queryKey: ["credits"] });
          break;
        case "review":
          queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
          queryClient.invalidateQueries({ queryKey: ["positions"] });
          break;
      }

      playNotification();
    });

    return unsubscribe;
  }, [queryClient]);

  return wsStatus;
}
