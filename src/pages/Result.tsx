import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { buildFabricResult } from "@/lib/habi";

const Result = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resultType = (params.get("type") === "fail" ? "fail" : "success") as "success" | "fail";

  const fabric = useMemo(() => buildFabricResult(resultType), [resultType]);
  const gradient =
    resultType === "success" ? "var(--gradient-success)" : "var(--gradient-fail)";
  const gradeColor =
    resultType === "success" ? "hsl(var(--sage-green))" : "hsl(var(--warning-red))";

  return (
    <div className="min-h-screen text-white" style={{ background: gradient }}>
      <div className="px-5 pb-10 pt-12">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
            aria-label="Home"
          >
            ←
          </button>
          <button
            onClick={() => navigate("/scanner")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
            aria-label="Scan another"
          >
            ⟳
          </button>
        </div>

        <div
          className="mx-auto mt-5 flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white"
          style={{ boxShadow: "0 10px 20px rgba(0,0,0,0.25)" }}
        >
          <span className="text-[42px] font-bold leading-none" style={{ color: gradeColor }}>
            {fabric.grade}
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-[#888]">GRADE</span>
        </div>

        <div className="mt-3 text-center">
          <h1 className="text-2xl font-bold">{fabric.name}</h1>
          <p className="text-sm opacity-80">{fabric.fiberType}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 text-foreground">
            <div className="text-2xl">💨</div>
            <div className="text-2xl font-bold">{fabric.breathability}%</div>
            <div className="text-xs opacity-70">Breathability</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-foreground">
            <div className="text-2xl">🌿</div>
            <div className="text-2xl font-bold">{fabric.sustainability}%</div>
            <div className="text-xs opacity-70">Sustainability</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 text-foreground">
          <div className="flex gap-3">
            <span className="text-2xl">💧</span>
            <div>
              <div className="font-semibold">Fabric Analysis</div>
              <p className="mt-1 text-[13px] leading-relaxed">{fabric.personalMessage}</p>
            </div>
          </div>
        </div>

        {fabric.climateAlert && (
          <div className="mt-3 rounded-2xl bg-white/15 p-4 text-sm">
            <div className="font-semibold">⚠️ Climate alert</div>
            <p className="mt-1 text-[13px] leading-relaxed opacity-90">{fabric.climateAlert}</p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {[
            { emoji: "✨", label: "Wash Tips" },
            { emoji: "💰", label: "Resale" },
            { emoji: "♻️", label: "Upcycle" },
          ].map((c) => (
            <div
              key={c.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-foreground"
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-[11px] font-semibold">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 text-foreground">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resale Value
          </div>
          <div className="mt-1 text-lg font-bold">{fabric.resaleValue}</div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upcycling Idea
          </div>
          <p className="mt-1 text-sm">{fabric.upcyclingIdea}</p>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Wash Tips
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {fabric.washTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <Button
          onClick={() => navigate("/scanner")}
          className="mt-6 h-14 w-full rounded-full bg-white text-base font-bold text-[#222] hover:bg-white/90"
          style={{ boxShadow: "0 6px 14px rgba(0,0,0,0.2)" }}
        >
          Scan Another Item
        </Button>
      </div>
    </div>
  );
};

export default Result;