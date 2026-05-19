import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

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
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      navigate("/dashboard");
    } catch (err) {
      setError(`Guest sign-in failed: ${(err as Error).message}`);
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
    <div className="min-h-screen bg-cream">
      <div className="relative h-44 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-deep-sage opacity-[0.08]" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-sage-green opacity-[0.08]" />
      </div>

      <div className="-mt-16 flex flex-col items-center gap-2">
        <div
          className="flex h-[90px] w-[90px] items-center justify-center rounded-3xl bg-deep-sage text-4xl"
          style={{ boxShadow: "0 8px 16px hsl(var(--deep-sage) / 0.35)" }}
        >
          🔍🌿
        </div>
        <h1 className="font-bold text-[28px] text-deep-sage">Habi-Check</h1>
        <p className="text-sm text-muted-foreground">Eco-conscious fabric scanner</p>
      </div>

      <form onSubmit={handleLogin} className="habi-card mx-5 mt-6 space-y-5">
        <div>
          <h2 className="text-[22px] font-semibold text-deep-sage">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Sign up to start scanning"}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-deep-sage">Email</label>
          <div className="rounded-2xl bg-input-bg px-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-[52px] w-full bg-transparent text-sm outline-none placeholder:text-[#B0A99A]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-deep-sage">Password</label>
          <div className="rounded-2xl bg-input-bg px-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-[52px] w-full bg-transparent text-sm outline-none placeholder:text-[#B0A99A]"
            />
          </div>
        </div>

        {error && <p className="text-xs text-warning-red">{error}</p>}

        <Button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-2xl bg-deep-sage text-base font-bold text-cream hover:bg-deep-sage/90"
        >
          {busy ? "..." : mode === "login" ? "Login" : "Sign up"}
        </Button>

        <div className="flex items-center gap-2.5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-[#B0A99A]">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          onClick={handleGuest}
          disabled={busy}
          variant="outline"
          className="h-14 w-full rounded-2xl border-2 border-sage-green bg-transparent text-base font-bold text-deep-sage hover:bg-sage-green/10"
        >
          Continue as Guest
        </Button>

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          variant="outline"
          className="h-14 w-full rounded-2xl border-2 border-deep-sage bg-cream text-base font-bold text-deep-sage hover:bg-deep-sage/5"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </Button>
      </form>

      <div className="mb-10 mt-5 flex justify-center gap-1 text-sm">
        <span className="text-muted-foreground">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}
        </span>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
          className="font-semibold text-terracotta"
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </div>
    </div>
  );
};

export default Login;
