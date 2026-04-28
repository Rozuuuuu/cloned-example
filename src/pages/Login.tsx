import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    localStorage.setItem("habi_user", email);
    navigate("/onboarding");
  };

  const handleGuest = () => {
    localStorage.setItem("habi_user", "guest");
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Decorative header */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-deep-sage opacity-[0.08]" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-sage-green opacity-[0.08]" />
      </div>

      {/* Logo & brand */}
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

      {/* Form card */}
      <form onSubmit={handleLogin} className="habi-card mx-5 mt-6 space-y-5">
        <div>
          <h2 className="text-[22px] font-semibold text-deep-sage">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
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

        <Button type="submit" className="h-14 w-full rounded-2xl bg-deep-sage text-base font-bold text-cream hover:bg-deep-sage/90">
          Login
        </Button>

        <div className="flex items-center gap-2.5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-[#B0A99A]">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          onClick={handleGuest}
          variant="outline"
          className="h-14 w-full rounded-2xl border-2 border-sage-green bg-transparent text-base font-bold text-deep-sage hover:bg-sage-green/10"
        >
          Continue as Guest
        </Button>
      </form>

      <div className="mb-10 mt-5 flex justify-center gap-1 text-sm">
        <span className="text-muted-foreground">Don't have an account?</span>
        <span className="font-semibold text-terracotta">Sign up</span>
      </div>
    </div>
  );
};

export default Login;