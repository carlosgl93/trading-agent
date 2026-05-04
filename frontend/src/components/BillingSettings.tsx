import { useState } from "preact/hooks";
import { CreditCard, ExternalLink, Zap, ArrowUpCircle } from "lucide-preact";
import { createBillingPortal, createCheckoutSession } from "../lib/api";
import { useCredits } from "../lib/hooks/useCredits";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  developer: "Developer",
};

const TIER_COLORS: Record<string, string> = {
  free: "#6B6047",
  pro: "#D4A820",
  developer: "#22d3ee",
};

interface Props {
  tier?: string;
}

export default function BillingSettings({ tier = "free" }: Props) {
  const { data: credits } = useCredits();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const url = await createBillingPortal();
      window.open(url, "_blank");
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async () => {
    setLoading("upgrade");
    try {
      const url = await createCheckoutSession("subscription", "pro");
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  const handleTopUp = async () => {
    setLoading("topup");
    try {
      const url = await createCheckoutSession("credits");
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <CreditCard size={14} style={{ color: "#D4A820" }} />
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            color: "#E8E0C8",
          }}
        >
          Billing
        </span>
      </div>

      {/* Current tier */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px",
          background: "#0B0A00",
          border: "1px solid #2A2618",
          borderRadius: "8px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              color: "#6B6047",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Current Plan
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "9999px",
              background: `${TIER_COLORS[tier] ?? "#6B6047"}20`,
              border: `1px solid ${TIER_COLORS[tier] ?? "#6B6047"}60`,
            }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: TIER_COLORS[tier] ?? "#6B6047",
              }}
            >
              {TIER_LABELS[tier] ?? tier}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "11px",
              color: "#6B6047",
              marginBottom: "4px",
            }}
          >
            Credits
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: "18px",
              color: "#E8E0C8",
            }}
          >
            {credits?.balance ?? "—"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tier !== "pro" && (
          <button
            onClick={handleUpgrade}
            disabled={loading === "upgrade"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "6px",
              background: "#E8673A",
              border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "13px",
              color: "#fff",
              opacity: loading === "upgrade" ? 0.7 : 1,
            }}
          >
            <ArrowUpCircle size={14} />
            Upgrade to Pro — $49/mo · 100 credits
          </button>
        )}

        <button
          onClick={handleTopUp}
          disabled={loading === "topup"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "6px",
            background: "#1C1A0F",
            border: "1px solid #2A2618",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: "13px",
            color: "#E8E0C8",
            opacity: loading === "topup" ? 0.7 : 1,
          }}
        >
          <Zap size={14} style={{ color: "#D4A820" }} />
          Buy 10 credits — $5.00
        </button>

        {tier === "pro" && (
          <button
            onClick={handlePortal}
            disabled={loading === "portal"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "6px",
              background: "#1C1A0F",
              border: "1px solid #2A2618",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              fontSize: "13px",
              color: "#6B6047",
              opacity: loading === "portal" ? 0.7 : 1,
            }}
          >
            <ExternalLink size={14} />
            Manage billing
          </button>
        )}
      </div>
    </div>
  );
}
