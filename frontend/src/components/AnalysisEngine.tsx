import { useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { Zap, Crown, Cpu } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useAnalysisMutation } from "../lib/hooks";
import { useCredits } from "../lib/hooks/useCredits";
import TickerInput from "./TickerInput";

function AnalysisEngineInner() {
  const [isPaid, setIsPaid] = useState(false);
  const { singleMutation, sequenceMutation } = useAnalysisMutation();
  const { data: credits } = useCredits();

  const balance = credits?.balance ?? null;
  const outOfCredits = balance !== null && balance <= 0;

  const isLoading = singleMutation.isPending || sequenceMutation.isPending;
  const isError = singleMutation.isError || sequenceMutation.isError;
  const rawError = singleMutation.error?.message ?? sequenceMutation.error?.message;
  const errorMsg = rawError === "INSUFFICIENT_CREDITS" ? "Out of credits — top up to continue" : rawError;

  const handleAnalyze = (ticker: string) => {
    singleMutation.mutate({ ticker, paid: isPaid });
  };

  const handleRunSequence = (tickers: string[]) => {
    sequenceMutation.mutate({ tickers, paid: isPaid });
  };

  return (
    <div class="rounded-xl border border-surface-500 bg-surface-800 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Zap size={16} class="text-accent-amber" />
          <h2
            class="text-sm font-semibold"
            style={{ fontFamily: "'Geist', sans-serif", color: "var(--color-text-base)" }}
          >
            Command Center
          </h2>
        </div>
        <div class="flex items-center gap-1.5">
          {isPaid && (
            <span class="text-[10px] font-bold text-gold-400 glow-gold-text tracking-wider flex items-center gap-1">
              <Crown size={12} />
              PAID TIER
            </span>
          )}
          <button
            onClick={() => setIsPaid(!isPaid)}
            class={`relative w-9 h-5 rounded-full transition-colors ${isPaid ? "bg-accent-amber" : "bg-surface-500"}`}
          >
            <span
              class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                isPaid ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {isPaid && (
        <div class="rounded-lg border border-accent-amber/20 bg-accent-amber/5 px-3 py-2">
          <div class="flex items-center gap-2 text-xs">
            <Cpu size={12} class="text-accent-amber" />
            <span class="font-medium" style={{ color: "#e8e0c8" }}>Lead Model</span>
            <span class="font-bold text-accent-amber glow-amber-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              deepseek-v4-flash
            </span>
          </div>
          <p class="text-[10px] mt-1" style={{ color: "#6b6047" }}>
            Premium routing with full model ladder fallback chain
          </p>
        </div>
      )}

      {balance !== null && (
        <div class="flex items-center justify-between text-[11px]" style={{ color: "#6b6047" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif" }}>1 credit per analysis</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: outOfCredits ? "#D95050" : "#D4A820" }}>
            {balance} left
          </span>
        </div>
      )}

      <TickerInput
        onAnalyze={handleAnalyze}
        onRunSequence={handleRunSequence}
        disabled={isLoading || outOfCredits}
      />

      {outOfCredits && !isLoading && (
        <div class="text-xs bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 flex items-center justify-between" style={{ color: "#D95050" }}>
          <span>Out of credits</span>
          <a href="/settings" style={{ color: "#E8673A", textDecoration: "none", fontWeight: 500 }}>Top up →</a>
        </div>
      )}

      {isError && !outOfCredits && (
        <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {errorMsg}
        </div>
      )}

      {isError && rawError === "INSUFFICIENT_CREDITS" && (
        <div class="text-xs bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 flex items-center justify-between" style={{ color: "#D95050" }}>
          <span>{errorMsg}</span>
          <a href="/settings" style={{ color: "#E8673A", textDecoration: "none", fontWeight: 500 }}>Top up →</a>
        </div>
      )}

      {singleMutation.data && (
        <div class="text-xs text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-lg px-3 py-2">
          Task queued: {singleMutation.data.ticker} ({singleMutation.data.status})
        </div>
      )}

      {sequenceMutation.data && (
        <div class="text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/20 rounded-lg px-3 py-2">
          Sequence queued: {sequenceMutation.data.tickers.join(", ")} ({sequenceMutation.data.status})
        </div>
      )}
    </div>
  );
}

export default function AnalysisEngine() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnalysisEngineInner />
    </QueryClientProvider>
  );
}
