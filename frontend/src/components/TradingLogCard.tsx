import { Brain, ChevronRight } from "lucide-preact";
import type { TradeLog } from "../lib/types";
import { RATING_COLORS, STATUS_COLORS } from "../lib/types";
import ModelLadder from "./ModelLadder";

interface TradingLogCardProps {
  log: TradeLog;
  paid?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

export default function TradingLogCard({ log, paid, onSelect, isSelected }: TradingLogCardProps) {
  const ratingColor = log.rating ? RATING_COLORS[log.rating] ?? "#94a3b8" : "#94a3b8";
  const statusColor = STATUS_COLORS[log.execution_status] ?? "#94a3b8";
  const shortModel = log.model_used.split("/").pop() ?? log.model_used;

  return (
    <div
      onClick={() => onSelect?.(log.id)}
      class={`rounded-lg border p-3 space-y-2 transition-colors ${
        onSelect ? "cursor-pointer hover:border-accent-cyan/40 hover:bg-surface-700/60" : ""
      } ${
        isSelected
          ? "border-accent-cyan/50 bg-surface-700/70"
          : paid
          ? "border-gold-500/30 bg-surface-700/70"
          : "border-surface-500 bg-surface-800"
      }`}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-zinc-100">{log.ticker}</span>
          {paid && (
            <span class="text-[10px] font-bold text-gold-400 glow-gold-text tracking-wider">
              PAID
            </span>
          )}
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-zinc-500">
            {new Date(log.created_at).toLocaleTimeString()}
          </span>
          {onSelect && (
            <ChevronRight
              size={13}
              class={`transition-colors ${isSelected ? "text-accent-cyan" : "text-zinc-600"}`}
            />
          )}
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <ModelLadder currentModel={log.model_used} />
      </div>

      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <Brain size={12} class="text-zinc-500" />
          <span class="text-zinc-400 max-w-[140px] truncate" title={log.model_used}>
            {shortModel}
          </span>
        </div>
        <span class="text-[10px]">{log.analysis_date}</span>
      </div>

      <div class="flex items-center gap-2">
        {log.rating && (
          <span
            class="px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              background: `${ratingColor}22`,
              color: ratingColor,
              border: `1px solid ${ratingColor}44`,
            }}
          >
            {log.rating}
          </span>
        )}
        <span
          class="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: `${statusColor}22`,
            color: statusColor,
            border: `1px solid ${statusColor}44`,
          }}
        >
          {log.execution_status}
        </span>
      </div>
    </div>
  );
}
