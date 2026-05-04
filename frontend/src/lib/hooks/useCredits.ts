import { useQuery } from "@tanstack/preact-query";
import { fetchCreditBalance } from "../api";

export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    queryFn: fetchCreditBalance,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
