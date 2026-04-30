import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type HulasLevel = "pawisin" | "normal" | "chill";

const options: { value: HulasLevel; emoji: string; title: string; subtitle: string }[] = [
  {
    value: "pawisin",
    emoji: "🥵",
    title: "Pawisin",
    subtitle: "I sweat easily — I need very breathable fabrics.",
  },
  {
    value: "normal",
    emoji: "😊",
    title: "Normal Lang",
    subtitle: "I'm comfortable in most weather and fabrics.",
  },
  {
    value: "chill",
    emoji: "🧊",
    title: "Chill Lang",
    subtitle: "I stay cool naturally — cotton or linen blends work great.",
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<HulasLevel>(
    (localStorage.getItem("hulas_level") as HulasLevel) || "pawisin"
  );

  const handleContinue = () => {
    localStorage.setItem("hulas_level", selected);
    navigate("/scanner");
  };

  return (
    <div className="min-h-screen bg-cream px-5 pb-10 pt-14">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-deep-sage text-3xl">
          🌿
        </div>
        <h1 className="text-[26px] font-bold text-deep-sage">What's your hulas level?</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tell us how you handle the heat so we can personalize fabric advice.
        </p>
      </div>

      <div className="space-y-3">
        {options.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`flex w-full items-center gap-4 rounded-3xl border-2 p-4 text-left transition-all ${
                active
                  ? "border-deep-sage bg-card"
                  : "border-transparent bg-card/70"
              }`}
              style={active ? { boxShadow: "var(--shadow-card)" } : undefined}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-input-bg text-3xl">
                {opt.emoji}
              </div>
              <div className="flex-1">
                <div className="font-bold text-deep-sage">{opt.title} Profile</div>
                <div className="text-xs text-muted-foreground">{opt.subtitle}</div>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 ${
                  active ? "border-deep-sage bg-deep-sage" : "border-muted-foreground/40"
                }`}
              />
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        className="mt-8 h-14 w-full rounded-2xl bg-deep-sage text-base font-bold text-cream hover:bg-deep-sage/90"
      >
        Continue
      </Button>
    </div>
  );
};

export default Onboarding;