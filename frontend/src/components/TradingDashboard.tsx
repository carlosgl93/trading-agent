import { useEffect, useState } from "preact/hooks";

interface TradeResult {
  id: string;
  ticker: string;
  analysis_date: string;
  rating: string | null;
  model_used: string;
  alpaca_order_id: string | null;
  execution_status: string;
  created_at: string;
}

const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const POLL_MS = 15_000;

const STATUS_COLORS: Record<string, string> = {
  executed: "#22c55e",
  skipped: "#94a3b8",
  failed: "#ef4444",
  pending: "#f59e0b",
};

const RATING_COLORS: Record<string, string> = {
  Buy: "#22c55e",
  Overweight: "#86efac",
  Hold: "#94a3b8",
  Underweight: "#fca5a5",
  Sell: "#ef4444",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
        borderRadius: "6px",
        padding: "2px 10px",
        fontWeight: 600,
        fontSize: "0.8rem",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function TradingDashboard() {
  const [rows, setRows] = useState<TradeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchResults() {
    try {
      const res = await fetch(`${BACKEND_URL}/results?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TradeResult[] = await res.json();
      setRows(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch");
    }
  }

  useEffect(() => {
    fetchResults();
    const id = setInterval(fetchResults, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Live Trading Results</h2>
        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
          &nbsp;·&nbsp;polling every {POLL_MS / 1000}s
        </span>
      </div>

      {error && (
        <p style={{ color: "#ef4444", background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          ⚠ {error}
        </p>
      )}

      {rows.length === 0 && !error && (
        <p style={{ color: "#64748b" }}>No results yet. Waiting for the worker to run its first analysis…</p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Ticker", "Date", "Rating", "Model", "Order ID", "Status", "Timestamp"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#475569", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700 }}>{r.ticker}</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>{r.analysis_date}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {r.rating ? (
                      <Badge label={r.rating} color={RATING_COLORS[r.rating] ?? "#94a3b8"} />
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#64748b", fontSize: "0.78rem" }}>
                    {r.model_used.split("/").pop()}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b" }}>
                    {r.alpaca_order_id ? r.alpaca_order_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <Badge
                      label={r.execution_status}
                      color={STATUS_COLORS[r.execution_status] ?? "#94a3b8"}
                    />
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#64748b", fontSize: "0.78rem" }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
