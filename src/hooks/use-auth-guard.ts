import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Protect a route behind authentication. Redirects to /login when there's
 * no session and reacts to SIGNED_OUT / token expiration so an expired
 * session immediately kicks the user back to the login screen.
 */
export const useAuthGuard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Set up listener BEFORE getSession to avoid race conditions.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (event === "SIGNED_OUT" || (!s && event !== "INITIAL_SESSION")) {
        navigate("/login", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setChecked(true);
      if (!s) navigate("/login", { replace: true });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return { session, checked };
};

export const signOutEverywhere = async () => {
  // `global` revokes all refresh tokens server-side (Google + email/password
  // sessions both end). Then clear any local app caches/drafts.
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    await supabase.auth.signOut();
  }
  try {
    // Best-effort: wipe any lingering supabase auth keys.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.startsWith("supabase."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};