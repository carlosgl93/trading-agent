import { useQuery } from "@tanstack/preact-query";
import type { PortfolioPosition } from "../types";
import { apiFetch } from "../supabase";

async function fetchPositions(): Promise<PortfolioPosition[]> {
  const res = await apiFetch("/positions");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function usePositions() {
  return useQuery<PortfolioPosition[], Error>({
    queryKey: ["positions"],
    queryFn: fetchPositions,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
