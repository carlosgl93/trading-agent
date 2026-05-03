import { MODEL_LADDER } from "../lib/types";

interface ModelLadderProps {
  currentModel: string;
}

function stepIcon(step: string, isActive: boolean, isPassed: boolean) {
  if (isActive) return "●";
  if (isPassed) return "○";
  return "○";
}

export default function ModelLadder({ currentModel }: ModelLadderProps) {
  const lower = currentModel.toLowerCase();

  let activeIdx = -1;
  for (let i = MODEL_LADDER.length - 1; i >= 0; i--) {
    if (lower.includes(MODEL_LADDER[i].toLowerCase())) {
      activeIdx = i;
      break;
    }
  }

  return (
    <div class="flex items-center gap-0 text-xs">
      {MODEL_LADDER.map((step, i) => {
        const isPassed = i < activeIdx;
        const isActive = i === activeIdx;
        const isDimmed = i > activeIdx;

        return (
          <div key={step} class="flex items-center">
            <div
              class={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
                isActive
                  ? "bg-accent-green/15 text-accent-green font-bold"
                  : isPassed
                  ? "text-zinc-500"
                  : "text-zinc-600"
              }`}
            >
              <span>{stepIcon(step, isActive, isPassed)}</span>
              <span>{step}</span>
            </div>
            {i < MODEL_LADDER.length - 1 && (
              <span class={`text-xs mx-0.5 ${isPassed || isActive ? "text-accent-green/40" : "text-zinc-700"}`}>
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
