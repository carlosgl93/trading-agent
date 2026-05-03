import { QueryClientProvider } from "@tanstack/preact-query";
import { queryClient } from "../lib/hooks/queryClient";
import { useHealth, useScoutHistory, useTaskEvents } from "../lib/hooks";

function SystemStatusInner() {
  const { data: health, isLoading: healthLoading, isError: healthError } = useHealth();
  const { data: scoutHistory } = useScoutHistory();
  const wsStatus = useTaskEvents();

  const isHealthy = !healthLoading && !healthError && (health?.status === "ok" || health?.status === "healthy");
  const isConnected = wsStatus.value === "connected";
  const lastScout = scoutHistory?.[0];

  return (
    <div class="flex items-center gap-4 text-[11px]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div class="flex items-center gap-1.5" style={{ color: isHealthy ? "#6bcb77" : "#d95050" }}>
        <span class={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-accent-green" : "bg-accent-red"}`} />
        <span>API</span>
      </div>

      <div class="flex items-center gap-1.5" style={{ color: isConnected ? "#6bcb77" : "#6b6047" }}>
        <span
          class={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-accent-green agent-thinking" : "bg-surface-400"
          }`}
        />
        <span>WS</span>
      </div>

      {lastScout && (
        <div class="hidden md:flex items-center gap-1.5" style={{ color: "#6b6047" }}>
          <span>Scout</span>
          <span style={{ color: "#d4a820" }}>{lastScout.scout_date.slice(0, 10)}</span>
        </div>
      )}
    </div>
  );
}

export default function SystemStatus() {
  return (
    <QueryClientProvider client={queryClient}>
      <SystemStatusInner />
    </QueryClientProvider>
  );
}
