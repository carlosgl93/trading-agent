import { useState } from "preact/hooks";
import { Search, Send, List } from "lucide-preact";

interface TickerInputProps {
  onAnalyze: (ticker: string) => void;
  onRunSequence: (tickers: string[]) => void;
  disabled?: boolean;
}

export default function TickerInput({ onAnalyze, onRunSequence, disabled }: TickerInputProps) {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"single" | "sequence">("single");

  const tickers = raw
    .split(/[,\s\n]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const normalized = (raw || "").trim().toUpperCase();
  const isValid = normalized.length > 0;
  const isSequenceMode = mode === "sequence" || tickers.length > 1;

  const handleSubmit = () => {
    const list = raw
      .split(/[,\s\n]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (list.length === 0) return;
    if (list.length === 1 && mode === "single") {
      onAnalyze(list[0]);
    } else {
      onRunSequence(list);
    }
    setRaw("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <div class="flex bg-surface-600 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setMode("single")}
            class={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
              mode === "single" ? "bg-accent-amber text-black font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Search size={12} />
            Single
          </button>
          <button
            onClick={() => setMode("sequence")}
            class={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
              mode === "sequence" ? "bg-accent-amber text-black font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <List size={12} />
            Sequence
          </button>
        </div>
        {tickers.length > 1 && (
          <span class="text-xs text-accent-amber">
            {tickers.length} tickers
          </span>
        )}
      </div>

      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            type="text"
            value={raw}
            onInput={(e) => setRaw((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "single"
                ? "Enter ticker (e.g. AAPL)"
                : "Enter tickers (e.g. AAPL, MSFT, GOOGL)"
            }
            disabled={disabled}
            class="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-accent-amber/50 focus:ring-1 focus:ring-accent-amber/20 transition-colors disabled:opacity-50"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--color-text-base)" }}
          />
          {raw.length > 0 && (
            <div class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              {normalized}
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid || disabled}
          class="px-4 py-2.5 bg-accent-orange text-white font-semibold text-sm rounded-lg hover:bg-accent-orange/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0"
        >
          <Send size={14} />
          {isSequenceMode ? "Run Sequence" : "Analyze"}
        </button>
      </div>

      {tickers.length > 1 && (
        <div class="flex flex-wrap gap-1.5">
          {tickers.map((t) => (
            <span
              class="px-2 py-0.5 bg-surface-600 rounded text-xs font-mono"
              style={{ color: "var(--color-text-base)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
