import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { addScan, getHulas } from "@/lib/habi";

const Scanner = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [statusText, setStatusText] = useState("Point camera at fabric weave");

  const analyze = () => {
    setIsScanning(true);
    setStatusText("Analyzing fiber structure...");
    // Mock analyzer: 50/50 like FabricAnalyzerService
    const isNatural = Math.random() > 0.5;
    setTimeout(() => {
      const hulas = getHulas();
      void hulas;
      if (isNatural) {
        addScan({
          fabricName: "Premium Linen",
          grade: "A+",
          fiberType: "100% Natural Linen",
        });
        navigate("/result?type=success");
      } else {
        addScan({
          fabricName: "Polyester Blend",
          grade: "F-",
          fiberType: "85% Polyester, 15% Rayon",
        });
        navigate("/result?type=fail");
      }
    }, 2500);
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    analyze();
  };

  return (
    <div className="min-h-screen bg-[#0E1410] text-cream">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12">
        <button
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <span className="font-semibold">Fabric Scanner</span>
        <button
          onClick={() => setFlashOn((v) => !v)}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
            flashOn ? "bg-terracotta text-white" : "bg-white/20"
          }`}
          aria-label="Toggle flash"
        >
          ⚡
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative mx-5 mt-6 aspect-[3/4] overflow-hidden rounded-3xl border-2 border-white/20 bg-gradient-to-br from-[#1f2a22] to-[#0E1410]">
        <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-sage-green/60" />
        {/* Corner brackets */}
        {[
          "left-4 top-4 border-l-2 border-t-2",
          "right-4 top-4 border-r-2 border-t-2",
          "left-4 bottom-4 border-l-2 border-b-2",
          "right-4 bottom-4 border-r-2 border-b-2",
        ].map((c, i) => (
          <div key={i} className={`absolute h-8 w-8 rounded-md border-sage-green ${c}`} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl">📷</div>
            <p className="mt-3 text-sm text-cream/80">{statusText}</p>
          </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sage-green border-t-transparent" />
              <p className="mt-3 font-semibold">Analyzing fiber structure...</p>
              <p className="mt-1 text-xs opacity-70">This usually takes a moment</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input for gallery picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChosen}
      />

      <div className="px-5 pb-10 pt-6">
        <div className="grid grid-cols-3 items-center gap-3">
          {/* Gallery */}
          <button
            disabled={isScanning}
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.click();
              }
            }}
            className="flex h-14 items-center justify-center rounded-2xl bg-white/15 text-2xl disabled:opacity-50"
            aria-label="Pick from gallery"
          >
            🖼️
          </button>

          {/* Capture / scan */}
          <button
            disabled={isScanning}
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.click();
              }
            }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-cream bg-sage-green text-3xl text-white disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-fab)" }}
            aria-label="Capture photo"
          >
            📸
          </button>

          {/* Demo analyze (since browser camera in preview is unreliable) */}
          <button
            disabled={isScanning}
            onClick={analyze}
            className="flex h-14 items-center justify-center rounded-2xl bg-white/15 text-2xl disabled:opacity-50"
            aria-label="Demo analyze"
          >
            🧪
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-cream/60">
          Tap 📸 to capture · 🖼️ to pick from gallery · 🧪 to run a demo scan
        </p>
      </div>
    </div>
  );
};

export default Scanner;
