import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { addScan } from "@/lib/habi";

const Scanner = () => {
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = (resultType: "success" | "fail") => {
    setAnalyzing(true);
    setTimeout(() => {
      if (resultType === "success") {
        addScan({ fabricName: "Premium Linen", grade: "A+", fiberType: "100% Natural Linen" });
      } else {
        addScan({ fabricName: "Polyester Blend", grade: "F-", fiberType: "85% Polyester, 15% Rayon" });
      }
      navigate(`/result?type=${resultType}`);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#0E1410] text-cream">
      <div className="flex items-center justify-between px-5 pt-12">
        <button
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <span className="font-semibold">Fabric Scanner</span>
        <div className="h-11 w-11" />
      </div>

      {/* Camera viewfinder */}
      <div className="mx-5 mt-6 aspect-[3/4] overflow-hidden rounded-3xl border-2 border-white/20 bg-gradient-to-br from-[#1f2a22] to-[#0E1410] relative">
        <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-sage-green/60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl">📷</div>
            <p className="mt-3 text-sm text-cream/80">Position fabric inside the frame</p>
          </div>
        </div>
        {analyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sage-green border-t-transparent" />
              <p className="mt-3 font-semibold">Analyzing fabric...</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-10 pt-6">
        <p className="mb-4 text-center text-xs text-cream/60">
          Demo: pick a sample to see how Habi-Check rates a fabric.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            disabled={analyzing}
            onClick={() => handleAnalyze("success")}
            className="h-14 rounded-2xl bg-sage-green text-base font-bold text-white hover:bg-sage-green/90"
          >
            🌿 Natural sample
          </Button>
          <Button
            disabled={analyzing}
            onClick={() => handleAnalyze("fail")}
            className="h-14 rounded-2xl bg-warning-red text-base font-bold text-white hover:bg-warning-red/90"
          >
            🧪 Synthetic sample
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Scanner;