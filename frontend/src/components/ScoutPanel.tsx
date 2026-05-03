import { useState } from "preact/hooks";
import { QueryClientProvider } from "@tanstack/preact-query";
import { Bot, Crown, Play, Settings, ChevronDown } from "lucide-preact";
import { queryClient } from "../lib/hooks/queryClient";
import { useScoutMutation, useScoutHistory } from "../lib/hooks";
import {
  SCOUT_SECTORS,
  type ScoutRiskLevel,
  type ScoutTimeHorizon,
  type ScoutStyle,
} from "../lib/types";

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; color?: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div class="flex items-center flex-wrap gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        const color = opt.color ?? "#d4a820";
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
            style={
              active
                ? { background: `${color}22`, color, border: `1px solid ${color}55` }
                : { background: "transparent", color: "#6b6047", border: "1px solid #2a2618" }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectorSelect({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const toggle = (sector: string) => {
    const next = new Set(selected);
    if (next.has(sector)) next.delete(sector);
    else next.add(sector);
    onChange(next);
  };

  return (
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[10px]" style={{ color: "#6b6047" }}>
        <span>Sectors <span style={{ color: "#3a3420" }}>(empty = all)</span></span>
        {selected.size > 0 && (
          <button
            onClick={() => onChange(new Set())}
            class="hover:text-zinc-400 transition-colors"
            style={{ color: "#3a3420" }}
          >
            clear
          </button>
        )}
      </div>
      <div class="flex flex-wrap gap-1">
        {SCOUT_SECTORS.map((s) => {
          const active = selected.has(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
              style={
                active
                  ? { background: "#d4a82022", color: "#d4a820", border: "1px solid #d4a82055" }
                  : { background: "transparent", color: "#6b6047", border: "1px solid #1c1a0f" }
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoutPanelInner() {
  const [isPaid, setIsPaid] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [riskLevel, setRiskLevel] = useState<ScoutRiskLevel>("moderate");
  const [timeHorizon, setTimeHorizon] = useState<ScoutTimeHorizon>("medium");
  const [style, setStyle] = useState<ScoutStyle>("any");
  const [focusSectors, setFocusSectors] = useState<Set<string>>(new Set());

  const mutation = useScoutMutation();
  const { data: history } = useScoutHistory();
  const lastRun = history?.[0];

  const handleRun = () => {
    mutation.mutate({
      paid: isPaid,
      risk_level: riskLevel,
      time_horizon: timeHorizon,
      style,
      focus_sectors: focusSectors.size > 0 ? [...focusSectors] : undefined,
    });
  };

  const settingsSummary = [
    riskLevel !== "moderate" ? riskLevel : null,
    timeHorizon !== "medium" ? timeHorizon : null,
    style !== "any" ? style : null,
    focusSectors.size > 0 ? `${focusSectors.size} sector${focusSectors.size > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div class="rounded-xl border border-surface-500 bg-surface-800 p-4 space-y-3">
      {/* header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Bot size={16} class="text-accent-amber" />
          <h2
            class="text-sm font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--color-text-base)" }}
          >
            Autonomous Scout
          </h2>
        </div>
        <div class="flex items-center gap-1.5">
          {isPaid && (
            <span class="text-[10px] font-bold text-accent-amber glow-amber-text tracking-wider flex items-center gap-1">
              <Crown size={12} />
              PAID
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

      <p class="text-[11px]" style={{ color: "#6b6047" }}>
        Macro → sector → ticker reasoning. Auto-runs at{" "}
        <span style={{ color: "#4a4430" }}>9:00 AM ET</span> weekdays.
      </p>

      {/* last run summary */}
      {lastRun && (
        <div class="rounded-lg bg-surface-700/50 border border-surface-600 p-2.5 space-y-1.5">
          <div class="flex items-center justify-between text-[10px]">
            <span style={{ color: "#6b6047" }}>
              Last run: <span style={{ color: "#4a4430" }}>{lastRun.scout_date}</span>
            </span>
            <span class="text-zinc-600 truncate max-w-[120px]" title={lastRun.model_used}>
              {lastRun.model_used.split("/").pop()}
            </span>
          </div>
          {lastRun.tickers_json.length > 0 && (
            <div class="flex flex-wrap gap-1">
              {lastRun.tickers_json.map((t) => (
                <span
                  key={t.ticker}
                  title={`${t.sector} — ${t.thesis}`}
                  class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: "#d4a82015",
                    border: "1px solid #d4a82030",
                    color: "#d4a820",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {t.ticker}
                  <span style={{ color: "#6b6047", marginLeft: "2px", fontWeight: 400 }}>·{t.conviction}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs border hover:border-surface-500 transition-colors"
        style={{ color: "#6b6047", background: "#1c1a0f40", borderColor: "#2a2618" }}
      >
        <div class="flex items-center gap-1.5">
          <Settings size={12} />
          <span>Customize</span>
          {settingsSummary && (
            <span class="text-[10px] text-accent-amber">{settingsSummary}</span>
          )}
        </div>
        <ChevronDown
          size={13}
          class={`transition-transform ${showSettings ? "rotate-180" : ""}`}
        />
      </button>

      {/* settings panel */}
      {showSettings && (
        <div class="rounded-lg border border-surface-600 bg-surface-700/30 p-3 space-y-3">
          <div class="space-y-1.5">
            <div class="text-[10px] tracking-wider" style={{ color: "#6b6047" }}>Risk Level</div>
            <PillGroup
              options={[
                { value: "conservative" as ScoutRiskLevel, label: "Conservative", color: "#22d3ee" },
                { value: "moderate" as ScoutRiskLevel, label: "Moderate", color: "#d4a820" },
                { value: "aggressive" as ScoutRiskLevel, label: "Aggressive", color: "#d95050" },
              ]}
              value={riskLevel}
              onChange={setRiskLevel}
            />
          </div>

          <div class="space-y-1.5">
            <div class="text-[10px] tracking-wider" style={{ color: "#6b6047" }}>Time Horizon</div>
            <PillGroup
              options={[
                { value: "short" as ScoutTimeHorizon, label: "Short (1–4w)", color: "#d4a820" },
                { value: "medium" as ScoutTimeHorizon, label: "Mid (1–3m)", color: "#d4a820" },
                { value: "long" as ScoutTimeHorizon, label: "Long (6–12m)", color: "#d4a820" },
              ]}
              value={timeHorizon}
              onChange={setTimeHorizon}
            />
          </div>

          <div class="space-y-1.5">
            <div class="text-[10px] tracking-wider" style={{ color: "#6b6047" }}>Style</div>
            <PillGroup
              options={[
                { value: "any" as ScoutStyle, label: "Any", color: "#6b6047" },
                { value: "growth" as ScoutStyle, label: "Growth", color: "#6bcb77" },
                { value: "value" as ScoutStyle, label: "Value", color: "#d4a820" },
                { value: "momentum" as ScoutStyle, label: "Momentum", color: "#e8673a" },
                { value: "quality" as ScoutStyle, label: "Quality", color: "#22d3ee" },
              ]}
              value={style}
              onChange={setStyle}
            />
          </div>

          <SectorSelect selected={focusSectors} onChange={setFocusSectors} />
        </div>
      )}

      {/* run button */}
      <button
        onClick={handleRun}
        disabled={mutation.isPending}
        class="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "#e8673a18",
          border: "1px solid #e8673a35",
          color: "#e8673a",
        }}
      >
        {mutation.isPending ? (
          <div class="w-3.5 h-3.5 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
        ) : (
          <Play size={12} />
        )}
        {mutation.isPending ? "Scouting…" : "Run Scout Now"}
      </button>

      {mutation.isError && (
        <div class="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {mutation.error?.message}
        </div>
      )}

      {mutation.data && !mutation.isPending && (
        <div class="text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/20 rounded-lg px-3 py-2">
          Scout queued — {mutation.data.status}
        </div>
      )}
    </div>
  );
}

export default function ScoutPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScoutPanelInner />
    </QueryClientProvider>
  );
}
