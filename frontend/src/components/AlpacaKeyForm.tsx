import { useState } from "preact/hooks";
import { Key, Check, AlertCircle } from "lucide-preact";
import { saveAlpacaKeys } from "../lib/api";

export default function AlpacaKeyForm() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [paper, setPaper] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    if (!apiKey || !apiSecret) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveAlpacaKeys(apiKey, apiSecret, paper);
      setStatus("saved");
      setApiKey("");
      setApiSecret("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save keys";
      setStatus("error");
      setErrorMsg(message);
    }
  };

  const inputStyle = {
    width: "100%",
    background: "#0B0A00",
    border: "1px solid #2A2618",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#E8E0C8",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    fontSize: "11px",
    color: "#6B6047",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "4px",
    display: "block",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <Key size={14} style={{ color: "#D4A820" }} />
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            color: "#E8E0C8",
          }}
        >
          Alpaca API Keys
        </span>
      </div>

      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#6B6047", margin: 0 }}>
        Keys are encrypted and stored in Supabase Vault. Never logged or exposed.
      </p>

      <div>
        <label style={labelStyle}>API Key</label>
        <input
          type="text"
          placeholder="PK..."
          value={apiKey}
          onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>API Secret</label>
        <input
          type="password"
          placeholder="••••••••••••••••"
          value={apiSecret}
          onInput={(e) => setApiSecret((e.target as HTMLInputElement).value)}
          style={inputStyle}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          color: "#E8E0C8",
        }}
      >
        <input
          type="checkbox"
          checked={paper}
          onChange={(e) => setPaper((e.target as HTMLInputElement).checked)}
          style={{ accentColor: "#D4A820" }}
        />
        Paper trading (safe mode)
      </label>

      {status === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            background: "rgba(217,80,80,0.1)",
            border: "1px solid rgba(217,80,80,0.3)",
            borderRadius: "6px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "#D95050",
          }}
        >
          <AlertCircle size={12} />
          {errorMsg}
        </div>
      )}

      {status === "saved" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            background: "rgba(107,203,119,0.1)",
            border: "1px solid rgba(107,203,119,0.3)",
            borderRadius: "6px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "#6BCB77",
          }}
        >
          <Check size={12} />
          Keys saved to Vault
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!apiKey || !apiSecret || status === "saving"}
        style={{
          padding: "8px 16px",
          borderRadius: "6px",
          background: (!apiKey || !apiSecret || status === "saving") ? "#1C1A0F" : "#E8673A",
          border: "none",
          cursor: (!apiKey || !apiSecret || status === "saving") ? "not-allowed" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          fontSize: "13px",
          color: (!apiKey || !apiSecret || status === "saving") ? "#6B6047" : "#fff",
          transition: "all 150ms ease-out",
          alignSelf: "flex-start",
        }}
      >
        {status === "saving" ? "Saving…" : "Save Keys"}
      </button>
    </div>
  );
}
