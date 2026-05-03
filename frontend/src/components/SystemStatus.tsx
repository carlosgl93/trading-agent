import { QueryClientProvider } from "@tanstack/preact-query";
import { Activity, Server, Shield } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useHealth, useScoutHistory } from "../lib/hooks";

function SystemStatusInner() {
  const { data: health, isLoading: healthLoading, isError: healthError } = useHealth();
  const { data: scoutHistory } = useScoutHistory();

  const isHealthy = health?.status === "ok" || health?.status === "healthy";
  const lastScout = scoutHistory && scoutHistory.length > 0 ? scoutHistory[0] : null;

  return (
    <div class="rounded-xl border border-surface-500 bg-surface-800 p-4">
      <div class="flex items-center gap-2 mb-3">
        <Activity size={16} class="text-accent-green" />
        <h2 class="text-sm font-semibold text-zinc-100">System Status</h2>
      </div>

      <div class="grid grid-cols-3 gap-3 text-xs">
        <div class="rounded-lg bg-surface-700/50 border border-surface-500 p-3 space-y-1.5">
          <div class="flex items-center gap-1.5 text-zinc-500">
            <Server size={12} />
            <span>API</span>
          </div>
          {healthLoading ? (
            <div class="w-3 h-3 border border-zinc-600 border-t-transparent rounded-full animate-spin" />
          ) : healthError ? (
            <span class="text-accent-red font-semibold">Offline</span>
          ) : (
            <div class="flex items-center gap-1.5">
              <span class={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-accent-green" : "bg-accent-red"}`} />
              <span class={`font-semibold ${isHealthy ? "text-accent-green" : "text-accent-red"}`}>
                {health?.status ?? "unknown"}
              </span>
            </div>
          )}
        </div>

        <div class="rounded-lg bg-surface-700/50 border border-surface-500 p-3 space-y-1.5">
          <div class="flex items-center gap-1.5 text-zinc-500">
            <Shield size={12} />
            <span>Scout</span>
          </div>
          {lastScout ? (
            <div>
              <span class="text-zinc-300 font-semibold">{lastScout.model_used.split("/").pop()}</span>
              <div class="text-[10px] text-zinc-600">
                {lastScout.scout_date.slice(0, 10)}
              </div>
            </div>
          ) : (
            <span class="text-zinc-600">Idle</span>
          )}
        </div>

        <div class="rounded-lg bg-surface-700/50 border border-surface-500 p-3 space-y-1.5">
          <div class="flex items-center gap-1.5 text-zinc-500">
            <Activity size={12} />
            <span>Polling</span>
          </div>
          <div class="text-zinc-400 space-y-0.5">
            <div class="flex justify-between">
              <span>Positions</span>
              <span class="text-zinc-500">15s</span>
            </div>
            <div class="flex justify-between">
              <span>Health</span>
              <span class="text-zinc-500">60s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SystemStatus() {
  return (
    <QueryClientProvider client={queryClient}>
      <SystemStatusInner />
    </QueryClientProvider>
  );
}
