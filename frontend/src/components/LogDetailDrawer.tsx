import { useEffect } from "preact/hooks";
import { X, TrendingUp, TrendingDown, Brain, Hash, Cpu, Calendar, AlertCircle } from "lucide-preact";
import type { TradeLogDetail } from "../lib/types";
import { RATING_COLORS, STATUS_COLORS } from "../lib/types";

interface Props {
  id: string | null;
  log: TradeLogDetail | undefined;
  isLoading: boolean;
  onClose: () => void;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      class="px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    const candidate = JSON.parse(text);
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    // plain text
  }

  if (parsed) {
    return (
      <div class="space-y-3 text-xs">
        {Object.entries(parsed).map(([key, value]) => (
          <div key={key}>
            <div class="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              {key.replace(/_/g, " ")}
            </div>
            <div class="text-zinc-300 leading-relaxed">
              {typeof value === "string"
                ? value
                : <pre class="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono">{JSON.stringify(value, null, 2)}</pre>
              }
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre class="text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
      {text}
    </pre>
  );
}

export default function LogDetailDrawer({ id, log, isLoading, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!id) return null;

  const ratingColor = log?.rating ? RATING_COLORS[log.rating] ?? "#94a3b8" : "#94a3b8";
  const statusColor = log ? STATUS_COLORS[log.execution_status] ?? "#94a3b8" : "#94a3b8";
  const isBuy = log?.rating && ["Buy", "Overweight"].includes(log.rating);

  return (
    <div class="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div class="relative w-full max-w-[520px] bg-surface-900 border-l border-surface-600 flex flex-col h-full shadow-2xl">
        {/* header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-surface-600 shrink-0">
          {isLoading ? (
            <div class="flex items-center gap-3">
              <div class="w-16 h-5 bg-surface-700 rounded animate-pulse" />
              <div class="w-12 h-5 bg-surface-700 rounded animate-pulse" />
            </div>
          ) : log ? (
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="font-bold text-lg text-zinc-100">{log.ticker}</span>
              {log.rating && <Badge label={log.rating} color={ratingColor} />}
              <Badge label={log.execution_status} color={statusColor} />
            </div>
          ) : (
            <span class="text-zinc-500 text-sm">Not found</span>
          )}
          <button
            onClick={onClose}
            class="text-zinc-500 hover:text-zinc-200 transition-colors p-1 shrink-0 ml-3"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && (
            <div class="space-y-3 animate-pulse">
              <div class="grid grid-cols-2 gap-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} class="h-16 bg-surface-700/50 rounded-lg" />
                ))}
              </div>
              <div class="h-20 bg-surface-700/50 rounded-lg" />
              <div class="h-48 bg-surface-700/50 rounded-lg" />
            </div>
          )}

          {!isLoading && !log && (
            <div class="flex items-center gap-2 text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-3">
              <AlertCircle size={14} />
              Could not load analysis detail.
            </div>
          )}

          {log && (
            <>
              {/* Meta grid */}
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-surface-800 border border-surface-600 p-3 space-y-1">
                  <div class="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <Calendar size={11} />
                    Date
                  </div>
                  <div class="text-sm font-semibold text-zinc-200">{log.analysis_date}</div>
                </div>
                <div class="rounded-lg bg-surface-800 border border-surface-600 p-3 space-y-1">
                  <div class="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <Cpu size={11} />
                    Model
                  </div>
                  <div
                    class="text-sm font-semibold text-zinc-200 truncate"
                    title={log.model_used}
                  >
                    {log.model_used.split("/").pop()}
                  </div>
                </div>
              </div>

              {/* Alpaca execution block */}
              {log.alpaca_order_id ? (
                <div
                  class="rounded-lg border p-4 space-y-3"
                  style={{
                    borderColor: `${statusColor}40`,
                    background: `${statusColor}08`,
                  }}
                >
                  <div class="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    {isBuy ? (
                      <TrendingUp size={14} class="text-accent-green" />
                    ) : (
                      <TrendingDown size={14} class="text-accent-red" />
                    )}
                    Alpaca Execution
                    <span
                      class="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: `${statusColor}22`,
                        color: statusColor,
                        border: `1px solid ${statusColor}44`,
                      }}
                    >
                      {log.execution_status}
                    </span>
                  </div>
                  <div class="flex items-start gap-2 text-[11px]">
                    <Hash size={11} class="text-zinc-500 mt-0.5 shrink-0" />
                    <span class="font-mono text-zinc-400 break-all leading-relaxed">
                      {log.alpaca_order_id}
                    </span>
                  </div>
                  <div class="text-[11px] text-zinc-500">
                    Side: <span class="text-zinc-300 font-medium">
                      {isBuy ? "BUY (long)" : "SELL / CLOSE"}
                    </span>
                  </div>
                </div>
              ) : (
                <div class="rounded-lg border border-surface-600 bg-surface-800 px-4 py-3 text-xs text-zinc-500">
                  No Alpaca order — signal was <span class="text-zinc-300 font-medium">{log.rating ?? "unknown"}</span> ({log.execution_status})
                </div>
              )}

              {/* Reasoning */}
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                  <Brain size={13} />
                  Portfolio Manager Analysis
                </div>
                {log.reasoning ? (
                  <div class="rounded-lg bg-surface-800 border border-surface-600 p-4 max-h-[420px] overflow-y-auto">
                    <ReasoningBlock text={log.reasoning} />
                  </div>
                ) : (
                  <div class="rounded-lg bg-surface-800 border border-surface-600 px-4 py-6 text-xs text-zinc-600 text-center">
                    No reasoning recorded for this analysis.
                  </div>
                )}
              </div>

              {/* Raw report (if non-empty) */}
              {log.raw_report && Object.keys(log.raw_report).length > 0 && (
                <div class="space-y-2">
                  <div class="text-[10px] text-zinc-600 uppercase tracking-wider">Raw Report</div>
                  <div class="rounded-lg bg-surface-800 border border-surface-600 p-4 max-h-[200px] overflow-y-auto">
                    <pre class="text-[11px] text-zinc-500 whitespace-pre-wrap font-mono">
                      {JSON.stringify(log.raw_report, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        {log && (
          <div class="px-5 py-3 border-t border-surface-600 shrink-0 text-[10px] text-zinc-600">
            {new Date(log.created_at).toLocaleString()} · {log.id.slice(0, 8)}…
          </div>
        )}
      </div>
    </div>
  );
}
