import { useMutation, useQueryClient } from "@tanstack/preact-query";
import type { AnalysisInput, TaskQueued, SequenceQueued } from "../types";
import { BACKEND_URL } from "../types";

async function triggerSingleAnalysis(input: AnalysisInput): Promise<TaskQueued> {
  const res = await fetch(`${BACKEND_URL}/test-task/${input.ticker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid: input.paid ?? false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function triggerSequence(input: AnalysisInput): Promise<SequenceQueued> {
  const tickers = input.ticker
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const res = await fetch(`${BACKEND_URL}/run-sequence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, paid: input.paid ?? false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useAnalysisMutation() {
  const queryClient = useQueryClient();

  const singleMutation = useMutation<TaskQueued, Error, AnalysisInput>({
    mutationFn: triggerSingleAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
    },
  });

  const sequenceMutation = useMutation<SequenceQueued, Error, AnalysisInput>({
    mutationFn: triggerSequence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-logs"] });
    },
  });

  return { singleMutation, sequenceMutation };
}
