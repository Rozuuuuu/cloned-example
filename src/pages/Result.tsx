import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { buildFabricResult, getRecentScans, getScanImageUrl } from "@/lib/habi";
import SecurityIssues from "@/components/SecurityIssues";
import SpecimenGridLayout from "@/components/SpecimenGridLayout";

const Result = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ResultViewModel.OnResultTypeChanged: IsSuccess = value == "success".
  const raw = params.get("type") ?? "success";
  const isSuccess = raw === "success";
  const fabric = useMemo(
    () => buildFabricResult(isSuccess ? "success" : "fail"),
    [isSuccess]
  );

  // Look up the saved scan to render the captured photo (matches ImagePath in repo).
  const scanId = params.get("id");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!scanId) return;
    (async () => {
      const scans = await getRecentScans(10);
      const match = scans.find((s) => s.id === scanId);
      setImageUrl(await getScanImageUrl(match?.imagePath));
    })();
  }, [scanId]);

  const gradeColor = isSuccess ? "hsl(var(--sage-green))" : "hsl(var(--warning-red))";

  return (
    <SpecimenGridLayout
      title={fabric.name}
      eyebrow={`${fabric.fiberType} · Specimen report`}
      actions={
        <>
          <button
            onClick={() => navigate("/dashboard")}
            className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
          >
            ← Index
          </button>
          <button
            onClick={() => navigate("/scanner")}
            className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
          >
            ⟳ Rescan
          </button>
        </>
      }
    >
      <div className="grid gap-0 border-2 border-deep-sage md:grid-cols-12">
        {/* Plate: image + grade */}
        <div className="flex items-stretch border-b-2 border-deep-sage md:col-span-5 md:border-b-0 md:border-r-2">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={fabric.name}
              className="h-48 w-1/2 border-r-2 border-deep-sage object-cover md:h-full"
            />
          )}
          <div className="flex flex-1 flex-col items-center justify-center bg-card p-6">
            <span className="font-display text-[56px] leading-none" style={{ color: gradeColor }}>
              {fabric.grade}
            </span>
            <span className="type-label text-sage-green">Grade</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:col-span-7">
          <div className="border-r-2 border-deep-sage bg-card p-5">
            <div className="type-mono text-sage-green">01 · Breathability</div>
            <div className="type-h1 text-deep-sage">{fabric.breathability}%</div>
          </div>
          <div className="bg-card p-5">
            <div className="type-mono text-sage-green">02 · Sustainability</div>
            <div className="type-h1 text-deep-sage">{fabric.sustainability}%</div>
          </div>
          <div className="col-span-2 border-t-2 border-deep-sage bg-card p-5">
            <div className="type-mono text-sage-green">Fabric analysis</div>
            <p className="type-body mt-1 text-deep-sage">{fabric.personalMessage}</p>
          </div>
        </div>
      </div>

      {fabric.climateAlert && (
        <div className="mt-5 border-2 border-warning-red bg-warning-red/5 p-5">
          <div className="type-h3 text-warning-red">Climate alert</div>
          <p className="type-body mt-1 text-deep-sage">{fabric.climateAlert}</p>
        </div>
      )}

      <div className="mt-5 grid gap-0 border-2 border-deep-sage sm:grid-cols-3">
        {[
          { n: "03", label: "Wash Tips" },
          { n: "04", label: "Resale" },
          { n: "05", label: "Upcycle" },
        ].map((c) => (
          <div
            key={c.label}
            className="border-b-2 border-deep-sage bg-card p-4 last:border-b-0 sm:border-b-0 sm:border-r-2 sm:last:border-r-0"
          >
            <div className="type-mono text-sage-green">{c.n}</div>
            <div className="type-h3 text-deep-sage">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-2 border-deep-sage bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="type-mono text-sage-green">Resale value</div>
        <div className="type-h2 text-deep-sage">{fabric.resaleValue}</div>

        <div className="type-mono mt-4 border-t-2 border-deep-sage/20 pt-4 text-sage-green">
          Upcycling idea
        </div>
        <p className="type-body text-deep-sage">{fabric.upcyclingIdea}</p>

        <div className="type-mono mt-4 border-t-2 border-deep-sage/20 pt-4 text-sage-green">
          Wash tips
        </div>
        <ul className="type-body list-disc space-y-0.5 pl-5 text-deep-sage">
          {fabric.washTips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <Button
        onClick={() => navigate("/scanner")}
        className="type-h3 mt-6 h-auto w-full border-2 border-deep-sage bg-deep-sage py-4 text-cream hover:bg-sage-green"
      >
        Scan another item →
      </Button>

      <SecurityIssues scanId={scanId} />
    </SpecimenGridLayout>
  );
};

export default Result;

