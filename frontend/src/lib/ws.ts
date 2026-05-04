import { signal } from "@preact/signals";
import { BACKEND_URL } from "./types";

export interface TaskEvent {
  type: "task_complete" | "connected";
  kind?: "analysis" | "sequence" | "scout" | "review";
  ticker?: string | null;
  tickers?: string[] | null;
  status?: string;
  task_id?: string;
}

export const lastEvent = signal<TaskEvent | null>(null);
export const wsStatus = signal<"connecting" | "connected" | "disconnected">("disconnected");

let backoff = 1000;

export function startWebSocket() {
  if (typeof window === "undefined") return;

  const wsUrl = BACKEND_URL.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://") + "/ws";

  wsStatus.value = "connecting";

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    wsStatus.value = "connected";
    backoff = 1000;
  };

  ws.onmessage = event => {
    try {
      const parsed: TaskEvent = JSON.parse(event.data);
      lastEvent.value = parsed;
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    wsStatus.value = "disconnected";
    scheduleReconnect();
  };

  ws.onerror = () => {
    wsStatus.value = "disconnected";
    ws.close();
  };
}

function scheduleReconnect() {
  if (typeof window === "undefined") return;
  const delay = backoff;
  backoff = Math.min(backoff * 2, 30_000);
  setTimeout(startWebSocket, delay);
}

if (typeof window !== "undefined") {
  startWebSocket();
}
