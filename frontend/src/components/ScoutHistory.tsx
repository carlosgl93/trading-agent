import { useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { Radar, RefreshCw, ChevronRight } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useScoutHistory } from "../lib/hooks";
import type { ScoutLogEntry } from "../lib/types";
import ScoutDetailDrawer from "./ScoutDetailDrawer";

function convictionColor(n: number): string {
  if (n >= 5) return "#6bcb77";
  if (n >= 4) return "#d4a820";
  if (n >= 3) return "#e8673a";
  return "#6b6047";
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
            <Radar size={16} class="text-accent-amber" />
            <h2
              class="text-sm font-semibold"
              style={{ fontFamily: "'Geist', sans-serif", color: "var(--color-text-base)" }}
            >
              Scout History
            </h2>
          </div>
          <div class="flex items-center gap-2">
            {history && (
              <span class="text-[10px]" style={{ color: "#6b6047" }}>{history.length} runs</span>
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
            <div class="w-5 h-5 border-2 border-accent-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
            {error?.message ?? "Failed to load scout history"}
          </div>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <div class="text-xs text-center py-6" style={{ color: "#6b6047" }}>
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
                  class="rounded-lg border p-3 space-y-2 cursor-pointer transition-colors"
                  style={
                    isSelected
                      ? { borderColor: "#d4a82050", background: "#1c1a0f" }
                      : { borderColor: "#2a2618", background: "#141209" }
                  }
                >
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold" style={{ color: "var(--color-text-base)" }}>
                      {entry.scout_date}
                    </span>
                    <div class="flex items-center gap-1">
                      <span class="truncate max-w-[110px]" style={{ color: "#6b6047" }} title={entry.model_used}>
                        {entry.model_used.split("/").pop()}
                      </span>
                      <ChevronRight
                        size={12}
                        class="shrink-0 transition-colors"
                        style={{ color: isSelected ? "#d4a820" : "#3a3420" }}
                      />
                    </div>
                  </div>

                  {entry.macro_context && (
                    <p class="text-[11px] leading-relaxed line-clamp-2" style={{ color: "#6b6047" }}>
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
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {t.ticker}
                            <span style={{ opacity: 0.5, marginLeft: "4px", fontWeight: 400 }}>★{t.conviction}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span class="text-[11px]" style={{ color: "#3a3420" }}>No picks this run</span>
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
