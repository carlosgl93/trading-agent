import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BACKEND_URL } from "./types";

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  // import.meta.env is undefined during Astro static prerender (build step),
  // so lazy-init on first call (always client-side in the browser) to avoid
  // crashing the prerender with "supabaseUrl is required".
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set in the Vercel project env"
    );
  }
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

// Proxy so existing call sites keep using `supabase.auth.getSession()` etc.
// without caring that the underlying client is lazy.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(client(), prop, receiver);
  },
});

export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await client().auth.getSession();
  return session?.access_token ?? null;
}

export async function getCurrentUser() {
  const { data: { session } } = await client().auth.getSession();
  return session?.user ?? null;
}

export async function signOut() {
  await client().auth.signOut();
  window.location.href = "/login";
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
