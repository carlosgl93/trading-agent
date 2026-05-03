import { useEffect, useState } from "preact/hooks";
import { TrendingUp, TrendingDown, Clock } from "lucide-preact";
import type { PortfolioPosition } from "../lib/types";

interface PositionCardProps {
  position: PortfolioPosition;
}

function nextBeatCountdown(): string {
  const now = new Date();
  const etOffset = -5 * 60;
  const localOffset = now.getTimezoneOffset();
  const diffMs = (localOffset + etOffset) * 60 * 1000;
  const etNow = new Date(now.getTime() + diffMs);

  const beats = [
    { h: 9, m: 30 },
    { h: 12, m: 0 },
    { h: 15, m: 30 },
  ];

  const etMs = etNow.getHours() * 3600000 + etNow.getMinutes() * 60000 + etNow.getSeconds() * 1000 + etNow.getMilliseconds();

  for (const beat of beats) {
    const beatMs = beat.h * 3600000 + beat.m * 60000;
    if (etMs < beatMs) {
      const diff = beatMs - etMs;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return `${beat.h % 12 || 12}:${String(beat.m).padStart(2, "0")}${beat.h >= 12 ? "p" : "a"} (${h}h ${m}m)`;
    }
  }
  const firstBeat = beats[0];
  return `${firstBeat.h % 12 || 12}:${String(firstBeat.m).padStart(2, "0")}${firstBeat.h >= 12 ? "p" : "a"} (next day)`;
}

export default function PositionCard({ position }: PositionCardProps) {
  const isLong = position.direction === "long";
  const isOpen = position.status === "open";
  const [countdown, setCountdown] = useState(nextBeatCountdown);

  useEffect(() => {
    const id = setInterval(() => setCountdown(nextBeatCountdown()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      class={`rounded-lg border p-3 space-y-2 transition-colors ${
        isOpen
          ? isLong
            ? "border-accent-green/30 bg-surface-800"
            : "border-accent-red/30 bg-surface-800"
          : "border-surface-600 bg-surface-800/50 opacity-60"
      }`}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-zinc-100">{position.ticker}</span>
          <span
            class={`flex items-center gap-1 text-xs font-semibold ${
              isLong ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {isLong ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {position.direction}
          </span>
        </div>
        <span
          class={`text-[10px] px-2 py-0.5 rounded-full ${
            isOpen ? "bg-accent-green/15 text-accent-green" : "bg-zinc-500/20 text-zinc-500"
          }`}
        >
          {position.status}
        </span>
      </div>

      <div class="flex items-center gap-3 text-xs text-zinc-400">
        <span>
          Entry:{" "}
          <span class="font-semibold text-zinc-300">{position.entry_rating}</span>
        </span>
        <span>
          Since:{" "}
          <span class="text-zinc-300">{position.entry_date.slice(0, 10)}</span>
        </span>
      </div>

      {isOpen && (
        <div class="flex items-center gap-1.5 text-[11px] text-accent-amber">
          <Clock size={11} />
          <span>Next Beat: {countdown}</span>
        </div>
      )}
    </div>
  );
}
