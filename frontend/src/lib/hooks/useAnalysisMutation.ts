import { useMutation, useQueryClient } from "@tanstack/preact-query";
import type { AnalysisInput, TaskQueued, SequenceQueued } from "../types";
import { apiFetch } from "../supabase";

async function triggerSingleAnalysis(input: AnalysisInput): Promise<TaskQueued> {
  const res = await apiFetch(`/test-task/${input.ticker}?paid=${input.paid ?? false}`, {
    method: "POST",
  });
  if (res.status === 402) throw new Error("INSUFFICIENT_CREDITS");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function triggerSequence(input: AnalysisInput): Promise<SequenceQueued> {
  const tickers = input.ticker
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const res = await apiFetch(`/run-sequence?paid=${input.paid ?? false}`, {
    method: "POST",
    body: JSON.stringify(tickers),
  });
  if (res.status === 402) throw new Error("INSUFFICIENT_CREDITS");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useAnalysisMutation() {
  const queryClient = useQueryClient();

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
    queryClient.invalidateQueries({ queryKey: ["credits"] });
  };

  const singleMutation = useMutation<TaskQueued, Error, AnalysisInput>({
    mutationFn: triggerSingleAnalysis,
    onSuccess,
  });

  const sequenceMutation = useMutation<SequenceQueued, Error, AnalysisInput>({
    mutationFn: triggerSequence,
    onSuccess,
  });

  return { singleMutation, sequenceMutation };
}
