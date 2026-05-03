import { useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { Radar, RefreshCw, ChevronRight } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useScoutHistory } from "../lib/hooks";
import type { ScoutLogEntry } from "../lib/types";
import ScoutDetailDrawer from "./ScoutDetailDrawer";

function convictionColor(n: number): string {
  if (n >= 5) return "#4ade80";
  if (n >= 4) return "#22d3ee";
  if (n >= 3) return "#fbbf24";
  return "#94a3b8";
}

function ScoutHistoryInner() {
  const { data: history, isLoading, isError, error, isFetching, refetch } = useScoutHistory();
  const [selected, setSelected] = useState<ScoutLogEntry | null>(null);

  const handleSelect = (entry: ScoutLogEntry) => {
    setSelected((prev) => (prev?.id === entry.id ? null : entry));
  };

  return (
    <>
      <div class="rounded-xl border border-surface-500 bg-surface-800 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Radar size={16} class="text-accent-purple" />
            <h2 class="text-sm font-semibold text-zinc-100">Scout History</h2>
          </div>
          <div class="flex items-center gap-2">
            {history && (
              <span class="text-[10px] text-zinc-500">{history.length} runs</span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              class="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
            >
              <RefreshCw size={14} class={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div class="flex items-center justify-center py-6">
            <div class="w-5 h-5 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
            {error?.message ?? "Failed to load scout history"}
          </div>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <div class="text-xs text-zinc-500 text-center py-6">
            No scout runs yet. Click "Run Scout Now" to start.
          </div>
        )}

        {history && history.length > 0 && (
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {history.slice(0, 9).map((entry) => {
              const isSelected = selected?.id === entry.id;
              return (
                <div
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  class={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-accent-purple/50 bg-surface-700/70"
                      : "border-surface-600 bg-surface-700/40 hover:border-accent-purple/30 hover:bg-surface-700/60"
                  }`}
                >
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-zinc-300">{entry.scout_date}</span>
                    <div class="flex items-center gap-1">
                      <span class="text-zinc-600 truncate max-w-[110px]" title={entry.model_used}>
                        {entry.model_used.split("/").pop()}
                      </span>
                      <ChevronRight
                        size={12}
                        class={`shrink-0 transition-colors ${
                          isSelected ? "text-accent-purple" : "text-zinc-700"
                        }`}
                      />
                    </div>
                  </div>

                  {entry.macro_context && (
                    <p class="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                      {entry.macro_context}
                    </p>
                  )}

                  {entry.tickers_json.length > 0 ? (
                    <div class="flex flex-wrap gap-1.5">
                      {entry.tickers_json.map((t) => {
                        const color = convictionColor(t.conviction);
                        return (
                          <span
                            key={t.ticker}
                            class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${color}18`,
                              color,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {t.ticker}
                            <span class="opacity-50 ml-1 font-normal">★{t.conviction}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span class="text-[11px] text-zinc-600">No picks this run</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ScoutDetailDrawer entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function ScoutHistory() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScoutHistoryInner />
    </QueryClientProvider>
  );
}
