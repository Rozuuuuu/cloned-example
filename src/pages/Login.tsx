import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { logAuditEvent } from "@/lib/security";
import ThemeToggle from "@/components/ThemeToggle";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [guestErr, setGuestErr] = useState<{
    message: string;
    anonymousDisabled: boolean;
  } | null>(null);

  // If already signed in, skip to dashboard (mirrors LoginPage Shell behavior).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/dashboard` },
            });
      if (error) throw error;
      navigate("/dashboard");
    } catch (err) {
      setError(`Login failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Mirrors ContinueAsGuestAsync — uses anonymous sign-in so RLS still works.
  const handleGuest = async () => {
    setBusy(true);
    setError("");
    setGuestErr(null);
    await logAuditEvent({
      action: "guest_signin_attempt",
      resource_type: "auth",
      success: true,
    });
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      await logAuditEvent({
        action: "guest_signin_success",
        resource_type: "auth",
        success: true,
      });
      navigate("/dashboard");
    } catch (err) {
      const message = (err as Error).message ?? "Unknown error";
      const anonymousDisabled =
        /anonymous/i.test(message) && /disabl/i.test(message);
      setGuestErr({ message, anonymousDisabled });
      await logAuditEvent({
        action: "guest_signin_failure",
        resource_type: "auth",
        success: false,
        metadata: { error: message, anonymous_disabled: anonymousDisabled },
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      navigate("/dashboard");
    } catch (err) {
      setError(`Google sign-in failed: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream p-4 md:p-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 border-2 border-deep-sage bg-cream md:grid-cols-12">
        {/* Spine */}
        <div className="flex items-center justify-between gap-4 bg-deep-sage px-3 py-5 text-cream md:col-span-1 md:flex-col md:border-r-2 md:border-deep-sage">
          <span className="habi-spine font-display text-xs uppercase tracking-[0.28em]">
            Sustainable Textile Intelligence · Issue 01
          </span>
          <ThemeToggle inverted />
        </div>


        {/* Editorial plate */}
        <div className="flex flex-col border-b-2 border-deep-sage md:col-span-7 md:border-b-0 md:border-r-2">
          <div className="flex-grow p-8 md:p-12">
            <h1 className="font-display text-[22vw] leading-[0.82] text-deep-sage md:text-[8rem]">
              HABI
              <br />
              CHECK
            </h1>
            <div className="mt-8 grid grid-cols-2 gap-8 border-t-2 border-deep-sage pt-8">
              <div>
                <p className="habi-label mb-3">The Mission</p>
                <p className="text-sm leading-relaxed text-deep-sage">
                  Redefining the relationship between wearer and fiber. Habi-Check
                  scans, analyses and decodes the tropical performance of every
                  thread in your closet.
                </p>
              </div>
              <div className="flex items-end justify-end">
                <div className="flex h-24 w-24 flex-col items-center justify-center border-2 border-deep-sage bg-terracotta text-cream">
                  <span className="font-display text-3xl leading-none">01</span>
                  <span className="type-mono">Fiber</span>
                </div>
              </div>

            </div>
          </div>
          <div className="mt-auto border-t-2 border-deep-sage bg-sage-green p-6 text-cream">
            <p className="font-display text-4xl uppercase leading-none md:text-[3rem]">
              Truth in every thread.
            </p>
          </div>
        </div>

        {/* Access plate */}
        <div className="flex flex-col md:col-span-4">
          <form onSubmit={handleLogin} className="flex flex-grow flex-col justify-center gap-6 p-8 md:p-10">
            <h2 className="self-start border-b-4 border-terracotta font-display text-3xl text-deep-sage">
              {mode === "login" ? "Account Access" : "New Contributor"}
            </h2>

            <div>
              <label className="habi-label mb-2 block">Member Identifier</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@address.com"
                className="w-full border-b-2 border-deep-sage bg-transparent py-3 text-sm text-deep-sage outline-none transition-colors placeholder:text-sage-green/60 focus:border-sage-green"
              />
            </div>

            <div>
              <label className="habi-label mb-2 block">Secure Passkey</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-b-2 border-deep-sage bg-transparent py-3 text-sm text-deep-sage outline-none transition-colors placeholder:text-sage-green/60 focus:border-sage-green"
              />
            </div>

            {error && <p className="text-xs font-semibold text-warning-red">{error}</p>}

            <Button
              type="submit"
              disabled={busy}
              className="group flex h-auto w-full items-center justify-between bg-deep-sage px-6 py-5 text-cream hover:bg-sage-green"
            >
              <span className="font-display text-xl uppercase tracking-tight">
                {busy ? "Working…" : mode === "login" ? "Authenticate" : "Register"}
              </span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-[2px] flex-1 bg-deep-sage/20" />
              <span className="habi-label">or</span>
              <span className="h-[2px] flex-1 bg-deep-sage/20" />
            </div>

            <Button
              type="button"
              onClick={handleGuest}
              disabled={busy}
              variant="outline"
              className="h-auto w-full border-2 border-deep-sage bg-transparent py-4 font-display text-xl uppercase tracking-tight text-deep-sage hover:bg-deep-sage hover:text-cream"
            >
              Continue as Guest
            </Button>

            <Button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              variant="outline"
              className="h-auto w-full border-2 border-deep-sage bg-transparent py-4 font-display text-xl uppercase tracking-tight text-deep-sage hover:bg-deep-sage hover:text-cream"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continue with Google
            </Button>

            {guestErr && (
          <div
            role="alert"
            aria-live="polite"
            data-testid="guest-signin-error"
            className="border-2 border-warning-red bg-warning-red/5 p-4 text-sm text-warning-red"
          >
            <p className="font-display text-lg uppercase">Guest sign-in didn't work</p>
            <p className="mt-1 text-warning-red/90">
              {guestErr.anonymousDisabled
                ? "Anonymous sign-ins must be enabled in your backend auth settings before guest login can work."
                : guestErr.message}
            </p>
            <Button
              type="button"
              onClick={handleGuest}
              disabled={busy}
              data-testid="guest-signin-retry"
              className="mt-3 h-10 bg-warning-red text-cream hover:bg-warning-red/90"
            >
              Retry guest sign-in
            </Button>
          </div>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="border-t-2 border-deep-sage pt-4 text-left text-xs font-bold uppercase tracking-widest text-deep-sage hover:text-sage-green"
            >
              {mode === "login" ? "Become a contributor →" : "Back to sign in →"}
            </button>
          </form>

          <div className="grid grid-cols-2 border-t-2 border-deep-sage p-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <div className="border-r-2 border-deep-sage pr-2">Protocol v.4.0.2</div>
            <div className="pl-4 text-right">E-Scan Ready</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
