import { QueryClientProvider } from "@tanstack/preact-query";
import { LayoutDashboard, RefreshCw } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { usePositions } from "../lib/hooks";
import PositionCard from "./PositionCard";

function PortfolioMonitorInner() {
  const { data: positions, isLoading, isError, error, refetch, isFetching } = usePositions();

  const openPositions = positions?.filter((p) => p.status === "open") ?? [];
  const closedPositions = positions?.filter((p) => p.status !== "open") ?? [];

  return (
    <div class="rounded-xl border border-surface-500 bg-surface-800 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <LayoutDashboard size={16} class="text-accent-purple" />
          <h2 class="text-sm font-semibold text-zinc-100">Portfolio Monitor</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          class="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
        >
          <RefreshCw size={14} class={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isLoading && (
        <div class="flex items-center justify-center py-8">
          <div class="w-5 h-5 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {error?.message ?? "Failed to load positions"}
        </div>
      )}

      {!isLoading && !isError && positions && positions.length === 0 && (
        <div class="text-xs text-zinc-500 text-center py-6">
          No open positions yet
        </div>
      )}

      {!isLoading && !isError && (
        <div class="space-y-3">
          {openPositions.length > 0 && (
            <div>
              <div class="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                Open ({openPositions.length})
              </div>
              <div class="grid grid-cols-1 gap-2">
                {openPositions.map((p) => (
                  <PositionCard key={p.id} position={p} />
                ))}
              </div>
            </div>
          )}

          {closedPositions.length > 0 && (
            <div>
              <div class="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                Closed ({closedPositions.length})
              </div>
              <div class="grid grid-cols-1 gap-2">
                {closedPositions.slice(0, 3).map((p) => (
                  <PositionCard key={p.id} position={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortfolioMonitor() {
  return (
    <QueryClientProvider client={queryClient}>
      <PortfolioMonitorInner />
    </QueryClientProvider>
  );
}
