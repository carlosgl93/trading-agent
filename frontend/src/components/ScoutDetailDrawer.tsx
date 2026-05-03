import { useEffect, useState } from "preact/hooks";
import {
  X, MapPin, Brain, Bot, Calendar, Cpu, Star,
  TrendingUp, TrendingDown, Play, Crown, Minus, CheckCircle, AlertCircle, Check,
} from "lucide-preact";
import type { ScoutLogEntry, TradeOrderResult } from "../lib/types";
import { useAnalysisMutation, useTradeMutation } from "../lib/hooks";

interface Props {
  entry: ScoutLogEntry | null;
  onClose: () => void;
}

function convictionColor(n: number): string {
  if (n >= 5) return "#4ade80";
  if (n >= 4) return "#22d3ee";
  if (n >= 3) return "#fbbf24";
  return "#94a3b8";
}

function ConvictionStars({ n }: { n: number }) {
  const color = convictionColor(n);
  return (
    <span class="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={10}
          style={{ color: i <= n ? color : "#334155", fill: i <= n ? color : "none" }}
        />
      ))}
    </span>
  );
}

function OrderResult({ result }: { result: TradeOrderResult }) {
  const ok = result.alpaca_status !== "no_position" && result.order_id;
  return (
    <div
      class="flex items-center gap-1.5 text-[10px] rounded px-2 py-1"
      style={{
        background: ok ? "#4ade8012" : "#94a3b812",
        border: `1px solid ${ok ? "#4ade8030" : "#94a3b830"}`,
        color: ok ? "#4ade80" : "#94a3b8",
      }}
    >
      {ok
        ? <CheckCircle size={11} />
        : <AlertCircle size={11} />}
      <span class="font-semibold capitalize">{result.side}</span>
      {ok && result.order_id
        ? <span class="opacity-70">{result.order_id.slice(0, 8)}…</span>
        : <span class="opacity-70">{result.alpaca_status}</span>}
    </div>
  );
}

export default function ScoutDetailDrawer({ entry, onClose }: Props) {
  const [isPaid, setIsPaid] = useState(true);
  const [notional, setNotional] = useState(100);
  const [pendingAction, setPendingAction] = useState<{ ticker: string; side: string } | null>(null);
  const [orderResults, setOrderResults] = useState<Record<string, TradeOrderResult>>({});
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());

  const { sequenceMutation } = useAnalysisMutation();
  const tradeMutation = useTradeMutation();

  // Reset state when entry changes, default-select all tickers
  useEffect(() => {
    sequenceMutation.reset();
    setPendingAction(null);
    setOrderResults({});
    setSelectedTickers(new Set(entry?.tickers_json.map((t) => t.ticker.toUpperCase()) ?? []));
  }, [entry?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!entry) return null;

  const allTickers = entry.tickers_json.map((t) => t.ticker.toUpperCase());
  const analyzeTickers = allTickers.filter((t) => selectedTickers.has(t));
  const allSelected = analyzeTickers.length === allTickers.length;
  const noneSelected = selectedTickers.size === 0;

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const handleSelectAll = () =>
    setSelectedTickers(new Set(allTickers));

  const handleDeselectAll = () =>
    setSelectedTickers(new Set());

  const handleAnalyze = () => {
    sequenceMutation.mutate({ tickers: analyzeTickers, paid: isPaid });
  };

  const handleTrade = (ticker: string, side: "buy" | "sell" | "close") => {
    setPendingAction({ ticker, side });
    tradeMutation.mutate(
      { ticker, side, notional: side === "close" ? undefined : notional },
      {
        onSuccess: (data) => {
          setOrderResults((prev) => ({ ...prev, [ticker]: data }));
          setPendingAction(null);
        },
        onError: () => {
          setPendingAction(null);
        },
      },
    );
  };

  return (
    <div class="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div class="relative w-full max-w-[560px] bg-surface-900 border-l border-surface-600 flex flex-col h-full shadow-2xl">
        {/* header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-surface-600 shrink-0">
          <div class="flex items-center gap-2.5">
            <Bot size={16} class="text-accent-purple" />
            <span class="font-bold text-base text-zinc-100">Scout Run</span>
            <span class="text-[11px] text-zinc-500 bg-surface-700 px-2 py-0.5 rounded-full">
              {entry.scout_date}
            </span>
          </div>
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
          {/* meta */}
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg bg-surface-800 border border-surface-600 p-3 space-y-1">
              <div class="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
                <Calendar size={11} />
                Date
              </div>
              <div class="text-sm font-semibold text-zinc-200">{entry.scout_date}</div>
            </div>
            <div class="rounded-lg bg-surface-800 border border-surface-600 p-3 space-y-1">
              <div class="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
                <Cpu size={11} />
                Model
              </div>
              <div class="text-sm font-semibold text-zinc-200 truncate" title={entry.model_used}>
                {entry.model_used.split("/").pop()}
              </div>
            </div>
          </div>

          {/* macro context */}
          {entry.macro_context && (
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <Brain size={13} />
                Macro Regime Assessment
              </div>
              <div class="rounded-lg bg-surface-800 border border-surface-600 p-4">
                <p class="text-[13px] text-zinc-300 leading-relaxed">{entry.macro_context}</p>
              </div>
            </div>
          )}

          {/* picks */}
          <div class="space-y-2">
            {/* picks header */}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <TrendingUp size={13} />
                Picks
                <span class="text-zinc-600 font-normal">
                  ({entry.tickers_json.length} ticker{entry.tickers_json.length !== 1 ? "s" : ""})
                </span>
              </div>
              {entry.tickers_json.length > 0 && (
                <div class="flex items-center gap-2">
                  <button
                    onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
                  >
                    {allSelected ? "deselect all" : "select all"}
                  </button>
                </div>
              )}
            </div>

            {/* notional input row */}
            {entry.tickers_json.length > 0 && (
              <div class="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span>Notional for trades</span>
                <span class="text-zinc-500">$</span>
                <input
                  type="number"
                  value={notional}
                  onInput={(e) => setNotional(Math.max(1, Number((e.target as HTMLInputElement).value)))}
                  class="w-16 bg-surface-700 border border-surface-500 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-accent-cyan/50 text-right"
                  min="1"
                  step="50"
                />
              </div>
            )}

            {entry.tickers_json.length === 0 ? (
              <div class="rounded-lg bg-surface-800 border border-surface-600 px-4 py-6 text-xs text-zinc-600 text-center">
                No picks met the conviction threshold this run.
              </div>
            ) : (
              <div class="space-y-3">
                {entry.tickers_json.map((t) => {
                  const color = convictionColor(t.conviction);
                  const ticker = t.ticker.toUpperCase();
                  const isPending = pendingAction?.ticker === ticker;
                  const result = orderResults[ticker];
                  const isSelected = selectedTickers.has(ticker);

                  return (
                    <div
                      key={ticker}
                      class="rounded-lg border bg-surface-800 p-4 space-y-3 transition-opacity"
                      style={{
                        borderColor: isSelected ? `${color}30` : "#1e293b",
                        opacity: isSelected ? 1 : 0.45,
                      }}
                    >
                      {/* ticker header row */}
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-2.5">
                          {/* selection checkbox */}
                          <button
                            onClick={() => toggleTicker(ticker)}
                            class="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center transition-colors"
                            style={
                              isSelected
                                ? { background: `${color}33`, border: `1.5px solid ${color}88` }
                                : { background: "transparent", border: "1.5px solid #334155" }
                            }
                            aria-label={isSelected ? `Deselect ${ticker}` : `Select ${ticker}`}
                          >
                            {isSelected && <Check size={9} style={{ color }} />}
                          </button>
                          <div class="space-y-1">
                            <span class="font-bold text-base" style={{ color }}>
                              {ticker}
                            </span>
                            {t.sector && (
                              <div class="flex items-center gap-1 text-[11px] text-zinc-500">
                                <MapPin size={10} />
                                {t.sector}
                              </div>
                            )}
                          </div>
                        </div>
                        <div class="flex flex-col items-end gap-1 shrink-0">
                          <ConvictionStars n={t.conviction} />
                          <span
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: `${color}18`,
                              color,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {t.conviction}/5
                          </span>
                        </div>
                      </div>

                      {/* thesis */}
                      {t.thesis && (
                        <p class="text-[12px] text-zinc-400 leading-relaxed border-t border-surface-600 pt-2.5">
                          {t.thesis}
                        </p>
                      )}

                      {/* trade actions */}
                      <div class="flex items-center gap-2 border-t border-surface-600 pt-2.5">
                        {/* Buy */}
                        <button
                          onClick={() => handleTrade(ticker, "buy")}
                          disabled={!!pendingAction}
                          class="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-accent-green/10 border border-accent-green/25 text-accent-green hover:bg-accent-green/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isPending && pendingAction?.side === "buy" ? (
                            <div class="w-3 h-3 border border-accent-green border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrendingUp size={11} />
                          )}
                          Buy
                        </button>

                        {/* Short */}
                        <button
                          onClick={() => handleTrade(ticker, "sell")}
                          disabled={!!pendingAction}
                          class="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-accent-red/10 border border-accent-red/25 text-accent-red hover:bg-accent-red/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isPending && pendingAction?.side === "sell" ? (
                            <div class="w-3 h-3 border border-accent-red border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrendingDown size={11} />
                          )}
                          Short
                        </button>

                        {/* Close */}
                        <button
                          onClick={() => handleTrade(ticker, "close")}
                          disabled={!!pendingAction}
                          class="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-zinc-700/50 border border-zinc-600 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isPending && pendingAction?.side === "close" ? (
                            <div class="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Minus size={11} />
                          )}
                          Close
                        </button>

                        {/* result badge */}
                        {result && (
                          <div class="ml-auto">
                            <OrderResult result={result} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* trade error */}
          {tradeMutation.isError && (
            <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
              Trade failed: {tradeMutation.error?.message}
            </div>
          )}
        </div>

        {/* analyze CTA */}
        {allTickers.length > 0 && (
          <div class="px-5 py-4 border-t border-surface-600 shrink-0 space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-xs text-zinc-400">
                {noneSelected ? (
                  <span class="text-zinc-600">Select tickers above to analyze</span>
                ) : (
                  <>
                    Run full AI analysis on{" "}
                    <span class="font-semibold text-zinc-200">
                      {analyzeTickers.join(", ")}
                    </span>
                  </>
                )}
              </div>
              <div class="flex items-center gap-1.5 shrink-0 ml-3">
                {isPaid && (
                  <span class="text-[10px] font-bold text-gold-400 glow-gold-text flex items-center gap-0.5">
                    <Crown size={11} />
                    PAID
                  </span>
                )}
                <button
                  onClick={() => setIsPaid(!isPaid)}
                  class={`relative w-8 h-4 rounded-full transition-colors ${isPaid ? "bg-gold-500" : "bg-surface-500"}`}
                >
                  <span
                    class={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      isPaid ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={noneSelected || sequenceMutation.isPending || sequenceMutation.isSuccess}
              class="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sequenceMutation.isPending ? (
                <div class="w-3.5 h-3.5 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play size={12} />
              )}
              {sequenceMutation.isPending
                ? "Queuing…"
                : sequenceMutation.isSuccess
                ? `Queued: ${sequenceMutation.data?.tickers.join(", ")}`
                : noneSelected
                ? "Select tickers to analyze"
                : `Analyze ${analyzeTickers.length}/${allTickers.length} in Sequence`}
            </button>

            {sequenceMutation.isError && (
              <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
                {sequenceMutation.error?.message}
              </div>
            )}
          </div>
        )}

        {/* footer */}
        <div class="px-5 py-3 border-t border-surface-600 shrink-0 text-[10px] text-zinc-600">
          {new Date(entry.created_at).toLocaleString()} · {entry.id.slice(0, 8)}…
        </div>
      </div>
    </div>
  );
}
