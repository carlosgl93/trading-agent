import { useQuery } from "@tanstack/preact-query";
import type { HealthStatus } from "../types";
import { BACKEND_URL } from "../types";

async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useHealth() {
  return useQuery<HealthStatus, Error>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}
