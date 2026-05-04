import { useEffect, useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { queryClient } from "../lib/hooks/queryClient";
import { useTradeLogs, useTaskEvents } from "../lib/hooks";
import { lastEvent } from "../lib/ws";
import type { TaskEvent } from "../lib/ws";

const CALLSIGN_STYLE = { fontFamily: "'Geist', sans-serif" };
const MONO_STYLE = { fontFamily: "'JetBrains Mono', monospace" };
const LOG_STYLE = { fontFamily: "'IBM Plex Mono', monospace" };

const RATING_COLORS: Record<string, string> = {
  Buy: "#6bcb77",
  Overweight: "#6bcb77",
  Hold: "#d4a820",
  Underweight: "#d95050",
  Sell: "#d95050",
};

const STATUS_COLORS: Record<string, string> = {
  executed: "#6bcb77",
  skipped: "#6b6047",
  failed: "#d95050",
  pending: "#d4a820",
};

function AgentActivityFeedInner() {
  const { data: logs } = useTradeLogs();
  const wsStatus = useTaskEvents();
  const [flash, setFlash] = useState<TaskEvent | null>(null);

  useEffect(() => {
    return lastEvent.subscribe((event) => {
      if (!event || event.type !== "task_complete") return;
      setFlash(event);
      const t = setTimeout(() => setFlash(null), 4000);
      return () => clearTimeout(t);
    });
  }, []);

  const isConnected = wsStatus.value === "connected";
  const recentLogs = logs?.slice(0, 14) ?? [];

  return (
    <div class="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-surface-600">
        <span class="text-xs font-semibold tracking-widest" style={{ ...CALLSIGN_STYLE, color: "#d4a820" }}>
          AGENT ACTIVITY
        </span>
        <div class="flex items-center gap-1.5 text-[11px]" style={{ color: isConnected ? "#6bcb77" : "#6b6047" }}>
          <span
            class={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-accent-green agent-thinking" : "bg-surface-400"}`}
          />
          <span style={LOG_STYLE}>{isConnected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>

      <div class="p-4 space-y-2">
        {/* Flash: just-completed task */}
        {flash && (
          <div
            class="rounded-lg border px-4 py-3 mb-1"
            style={{ borderColor: "#6bcb7740", background: "#6bcb7708" }}
          >
            <div class="text-sm font-semibold" style={{ ...CALLSIGN_STYLE, color: "#6bcb77" }}>
              TASK COMPLETE
            </div>
            <div class="text-[11px] mt-0.5" style={{ ...LOG_STYLE, color: "#4a4430" }}>
              {flash.ticker ? `$${flash.ticker.toUpperCase()}` : flash.kind ?? "analysis"} ·{" "}
              {flash.status ?? "done"}
            </div>
          </div>
        )}

        {/* Recent decisions label */}
        {recentLogs.length > 0 && (
          <div class="text-[10px] tracking-widest pb-0.5" style={{ ...LOG_STYLE, color: "#3a3420" }}>
            RECENT DECISIONS
          </div>
        )}

        {/* Feed */}
        <div class="space-y-1 max-h-[460px] overflow-y-auto -mx-1 px-1">
          {recentLogs.map((log) => {
            const ratingColor = log.rating ? (RATING_COLORS[log.rating] ?? "#6b6047") : "#6b6047";
            const statusColor = STATUS_COLORS[log.execution_status] ?? "#6b6047";
            return (
              <div
                key={log.id}
                class="rounded-lg px-3 py-2.5 border border-transparent hover:border-surface-600 transition-colors"
                style={{ background: "#141209" }}
              >
                <div class="flex items-baseline justify-between gap-2">
                  <div class="flex items-baseline gap-2 min-w-0">
                    <span class="text-[10px] font-semibold tracking-widest shrink-0" style={{ ...CALLSIGN_STYLE, color: "#e8673a" }}>
                      TRADER
                    </span>
                    <span class="text-[10px] shrink-0" style={{ color: "#3a3420" }}>▸</span>
                    <span class="text-xs font-bold shrink-0" style={{ ...MONO_STYLE, color: ratingColor }}>
                      {log.rating ?? "—"}
                    </span>
                    <span class="text-sm font-bold truncate" style={{ ...MONO_STYLE, color: "#e8e0c8" }}>
                      ${log.ticker}
                    </span>
                  </div>
                  <span class="text-[10px] shrink-0" style={{ ...MONO_STYLE, color: statusColor }}>
                    {log.execution_status}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1 text-[10px]" style={{ ...LOG_STYLE, color: "#4a4430" }}>
                  <span>{log.analysis_date.slice(0, 10)}</span>
                  <span>·</span>
                  <span class="truncate">{log.model_used.split("/").pop()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {recentLogs.length === 0 && !flash && (
          <div class="text-center py-10 text-xs" style={{ ...LOG_STYLE, color: "#3a3420" }}>
            No decisions yet. Submit a ticker to begin.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentActivityFeed() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentActivityFeedInner />
    </QueryClientProvider>
  );
}
