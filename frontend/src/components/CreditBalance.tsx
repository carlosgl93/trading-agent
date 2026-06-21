import { Zap, Plus } from "lucide-preact";
import { QueryClientProvider } from "@tanstack/preact-query";
import { useCredits } from "../lib/hooks/useCredits";
import { queryClient } from "../lib/hooks/queryClient";
import { createCheckoutSession } from "../lib/api";
import { useState } from "preact/hooks";

function CreditBalanceInner() {
  const { data, isLoading } = useCredits();
  const [redirecting, setRedirecting] = useState(false);

  const balance = data?.balance ?? 0;
  const low = !isLoading && balance <= 10;

  const handleTopUp = async () => {
    setRedirecting(true);
    try {
      const url = await createCheckoutSession("credits");
      window.location.href = url;
    } catch {
      setRedirecting(false);
    }
  };

  return (
    <div
      style={{
        background: "#141209",
        border: `1px solid ${low ? "rgba(212,168,32,0.3)" : "#2A2618"}`,
        borderRadius: "8px",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        animation: low ? "amberPulse 2.4s ease-in-out infinite" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Zap size={14} style={{ color: low ? "#D4A820" : "#6B6047" }} />
        <div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: "20px",
              color: low ? "#D4A820" : "#E8E0C8",
            }}
          >
            {isLoading ? "—" : balance}
          </span>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
              color: "#6B6047",
              marginLeft: "6px",
            }}
          >
            {low ? "credits low" : "credits remaining"}
          </span>
        </div>
      </div>

      <button
        onClick={handleTopUp}
        disabled={redirecting}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 12px",
          borderRadius: "6px",
          background: "#E8673A",
          border: "none",
          cursor: redirecting ? "not-allowed" : "pointer",
          opacity: redirecting ? 0.7 : 1,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "12px",
          color: "#fff",
        }}
      >
        <Plus size={12} />
        Top up
      </button>

      <style>{`
        @keyframes amberPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function CreditBalance() {
  return (
    <QueryClientProvider client={queryClient}>
      <CreditBalanceInner />
    </QueryClientProvider>
  );
}
