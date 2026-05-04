import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { supabase } from "../lib/supabase";

interface Props {
  children: ComponentChildren;
}

export default function AuthGuard({ children }: Props) {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthed(true);
      } else {
        window.location.href = "/login";
      }
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/login";
      } else if (event === "SIGNED_IN") {
        setAuthed(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!checked) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0B0A00",
          color: "#6B6047",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
        }}
      >
        <span style={{ opacity: 0.7 }}>authenticating…</span>
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
