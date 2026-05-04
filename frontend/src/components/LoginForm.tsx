import { useState } from "preact/hooks";
import { TrendingUp, Mail } from "lucide-preact";

const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);
import { supabase } from "../lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleMagicLink = async (e: Event) => {
    e.preventDefault();
    if (!email) return;
    setLoading("magic");
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(null);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(provider);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (err) {
      setError(err.message);
      setLoading(null);
    }
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
    transition: "border-color 150ms ease-out",
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

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "'Geist', sans-serif",
                fontWeight: 600,
                fontSize: "16px",
                color: "#E8E0C8",
                marginBottom: "8px",
              }}
            >
              Check your inbox
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "#6B6047",
              }}
            >
              Magic link sent to <strong style={{ color: "#D4A820" }}>{email}</strong>
            </div>
          </div>
        ) : (
          <>
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

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} style={{ marginBottom: "16px" }}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
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
              <button
                type="submit"
                disabled={loading === "magic" || !email}
                style={{
                  ...btnBase,
                  background: loading === "magic" || !email ? "#1C1A0F" : "#E8673A",
                  border: "none",
                  color: loading === "magic" || !email ? "#6B6047" : "#fff",
                  cursor: loading === "magic" || !email ? "not-allowed" : "pointer",
                }}
              >
                <Mail size={14} />
                {loading === "magic" ? "Sending…" : "Send Magic Link"}
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "#2A2618" }} />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "11px",
                  color: "#6B6047",
                }}
              >
                or
              </span>
              <div style={{ flex: 1, height: "1px", background: "#2A2618" }} />
            </div>

            {/* OAuth */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => handleOAuth("google")}
                disabled={loading === "google"}
                style={{ ...btnBase, background: "#1C1A0F", color: "#E8E0C8" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading === "google" ? "Redirecting…" : "Continue with Google"}
              </button>

              <button
                onClick={() => handleOAuth("github")}
                disabled={loading === "github"}
                style={{ ...btnBase, background: "#1C1A0F", color: "#E8E0C8" }}
              >
                <GithubIcon size={16} />
                {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
              </button>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}
