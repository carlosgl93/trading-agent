import { useState } from "preact/hooks";
import { TrendingUp, LogIn } from "lucide-preact";
import { supabase } from "../lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: Event) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.href = "/";
  };

  const btnBase: preact.JSX.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "10px 16px",
    borderRadius: "6px",
    border: "1px solid #2A2618",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    fontSize: "14px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0A00",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "#141209",
          border: "1px solid #2A2618",
          borderRadius: "12px",
          padding: "32px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(212,168,32,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={20} style={{ color: "#D4A820" }} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 600,
                fontSize: "16px",
                color: "#E8E0C8",
              }}
            >
              TradingAgents
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#6B6047",
              }}
            >
              Mission Control
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 600,
            fontSize: "18px",
            color: "#E8E0C8",
            marginBottom: "4px",
          }}
        >
          Sign in
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            color: "#6B6047",
            marginBottom: "24px",
          }}
        >
          Your AI trading team is waiting.
        </div>

        <form onSubmit={handleSignIn}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            autoComplete="email"
            style={{
              width: "100%",
              background: "#0B0A00",
              border: "1px solid #2A2618",
              borderRadius: "6px",
              padding: "10px 14px",
              color: "#E8E0C8",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              outline: "none",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          />
          <input
            type="password"
            required
            placeholder="password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            autoComplete="current-password"
            style={{
              width: "100%",
              background: "#0B0A00",
              border: "1px solid #2A2618",
              borderRadius: "6px",
              padding: "10px 14px",
              color: "#E8E0C8",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              outline: "none",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              ...btnBase,
              background: loading || !email || !password ? "#1C1A0F" : "#E8673A",
              border: "none",
              color: loading || !email || !password ? "#6B6047" : "#fff",
              cursor: loading || !email || !password ? "not-allowed" : "pointer",
            }}
          >
            <LogIn size={14} />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "rgba(217,80,80,0.1)",
              border: "1px solid rgba(217,80,80,0.3)",
              borderRadius: "6px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              color: "#D95050",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
