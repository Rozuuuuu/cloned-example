import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
