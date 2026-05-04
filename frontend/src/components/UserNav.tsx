import { useEffect, useState } from "preact/hooks";
import { Settings, LogOut, Zap } from "lucide-preact";
import { supabase, signOut } from "../lib/supabase";
import { useCredits } from "../lib/hooks/useCredits";

export default function UserNav() {
  const [email, setEmail] = useState<string | null>(null);
  const { data: credits } = useCredits();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null);
    });
  }, []);

  const balance = credits?.balance ?? null;
  const low = balance !== null && balance <= 10;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {/* Credit display */}
      <a
        href="/settings"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "9999px",
          background: low ? "rgba(212,168,32,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${low ? "rgba(212,168,32,0.4)" : "rgba(42,38,24,1)"}`,
          textDecoration: "none",
          cursor: "pointer",
          animation: low ? "amberPulse 2.4s ease-in-out infinite" : "none",
        }}
      >
        <Zap size={12} style={{ color: low ? "#D4A820" : "#6B6047" }} />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: "12px",
            color: low ? "#D4A820" : "#E8E0C8",
          }}
        >
          {balance === null ? "—" : balance}
        </span>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: "10px",
            color: "#6B6047",
          }}
        >
          credits
        </span>
      </a>

      {/* User email */}
      {email && (
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: "12px",
            color: "#6B6047",
            maxWidth: "160px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email}
        </span>
      )}

      {/* Settings */}
      <a
        href="/settings"
        style={{ color: "#6B6047", display: "flex", alignItems: "center" }}
        title="Settings"
      >
        <Settings size={16} />
      </a>

      {/* Sign out */}
      <button
        onClick={signOut}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#6B6047",
          display: "flex",
          alignItems: "center",
          padding: 0,
        }}
        title="Sign out"
      >
        <LogOut size={16} />
      </button>

      <style>{`
        @keyframes amberPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
