import { useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { ScrollText, RefreshCw } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useTradeLogs, useTradeLogDetail } from "../lib/hooks";
import TradingLogCard from "./TradingLogCard";
import LogDetailDrawer from "./LogDetailDrawer";

function ExecutionLogsInner() {
  const { data: logs, isLoading, isError, error, isFetching, refetch } = useTradeLogs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail, isLoading: detailLoading } = useTradeLogDetail(selectedId);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div class="rounded-xl border border-surface-500 bg-surface-800 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ScrollText size={16} class="text-accent-cyan" />
            <h2 class="text-sm font-semibold text-zinc-100">Execution Logs</h2>
          </div>
          <div class="flex items-center gap-2">
            {logs && (
              <span class="text-[10px] text-zinc-500">{logs.length} results</span>
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
          <div class="flex items-center justify-center py-8">
            <div class="w-5 h-5 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
            {error?.message ?? "Failed to load trade logs"}
          </div>
        )}

        {!isLoading && !isError && (!logs || logs.length === 0) && (
          <div class="text-xs text-zinc-500 text-center py-6">
            No execution logs yet. Submit a ticker to begin.
          </div>
        )}

        {logs && logs.length > 0 && (
          <div class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <TradingLogCard
                key={log.id}
                log={log}
                onSelect={handleSelect}
                isSelected={selectedId === log.id}
              />
            ))}
          </div>
        )}
      </div>

      <LogDetailDrawer
        id={selectedId}
        log={detail}
        isLoading={detailLoading}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

export default function ExecutionLogs() {
  return (
    <QueryClientProvider client={queryClient}>
      <ExecutionLogsInner />
    </QueryClientProvider>
  );
}
