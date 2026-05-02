import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveScan } from "@/lib/habi";
import { toast } from "sonner";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap protects the analyze pipeline.
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const validateImage = (file: File): string | null => {
  if (!file.type.startsWith("image/")) return "Please pick an image file (JPG, PNG, or WebP).";
  if (ACCEPTED.length && file.type && !ACCEPTED.includes(file.type)) {
    return "Unsupported image type. Use JPG, PNG, or WebP.";
  }
  if (file.size > MAX_BYTES) return "Image is too large. Max size is 10 MB.";
  if (file.size === 0) return "That file looks empty. Try another photo.";
  return null;
};

type ScanState = "idle" | "analyzing";

const Scanner = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [flashOn, setFlashOn] = useState(false);
  const [statusText, setStatusText] = useState("Point camera at fabric weave");

  // Mirrors ScannerViewModel.ProcessPhotoAsync — analyze, save, then navigate.
  const processPhoto = async (file?: File | null) => {
    if (state === "analyzing") return;
    setState("analyzing");
    setStatusText("Analyzing fiber structure...");

    // Simulated FabricAnalyzerService delay (2.5s)
    await new Promise((r) => setTimeout(r, 2500));

    const isNatural = Math.random() > 0.5;
    const fabric = isNatural
      ? { fabricName: "Premium Linen", grade: "A+", fiberType: "100% Natural Linen" }
      : { fabricName: "Polyester Blend", grade: "F-", fiberType: "85% Polyester, 15% Rayon" };

    const saved = await saveScan({ ...fabric, imageFile: file ?? null });

    // ScannerViewModel always resets state in `finally` block.
    setState("idle");
    setStatusText("Point camera at fabric weave");

    const type = isNatural ? "success" : "warning";
    navigate(`/result?type=${type}${saved ? `&id=${saved.id}` : ""}`);
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    const err = validateImage(file);
    if (err) {
      toast.error(err);
      return;
    }
    void processPhoto(file);
  };

  const openCamera = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.setAttribute("capture", "environment");
    fileInputRef.current.click();
  };

  const openGallery = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.removeAttribute("capture");
    fileInputRef.current.click();
  };

  const isAnalyzing = state === "analyzing";

  return (
    <div className="min-h-screen bg-[#0E1410] text-cream">
      {/* Top bar — back / title / flash toggle (FlashOn) */}
      <div className="flex items-center justify-between px-5 pt-12">
        <button
          onClick={() => navigate(-1)}
          disabled={isAnalyzing}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl disabled:opacity-50"
          aria-label="Back"
        >
          ←
        </button>
        <span className="font-semibold">Fabric Scanner</span>
        <button
          onClick={() => setFlashOn((v) => !v)}
          disabled={isAnalyzing}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-colors disabled:opacity-50 ${
            flashOn ? "bg-terracotta text-white shadow-lg" : "bg-white/20"
          }`}
          aria-label="Toggle flash"
          aria-pressed={flashOn}
        >
          ⚡
        </button>
      </div>

      {/* Viewfinder — flash overlay reflects FlashOn state */}
      <div
        className={`relative mx-5 mt-6 aspect-[3/4] overflow-hidden rounded-3xl border-2 transition-all ${
          flashOn ? "border-terracotta/60 shadow-[0_0_40px_hsl(var(--terracotta)/0.4)]" : "border-white/20"
        } bg-gradient-to-br from-[#1f2a22] to-[#0E1410]`}
      >
        {flashOn && <div className="pointer-events-none absolute inset-0 bg-white/10" />}
        <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-sage-green/60" />
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

        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            {/* Animated scanline overlay */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-x-0 h-[2px] animate-scanline bg-sage-green/80 shadow-[0_0_12px_hsl(var(--sage-green))]" />
            </div>
            <div className="relative text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sage-green border-t-transparent" />
              <p className="mt-3 font-semibold">Analyzing fiber structure...</p>
              <p className="mt-1 text-xs opacity-70">This usually takes a moment</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChosen}
      />

      <div className="px-5 pb-10 pt-6">
        <div className="grid grid-cols-3 items-center gap-3">
          {/* PickFromGalleryAsync */}
          <button
            disabled={isAnalyzing}
            onClick={openGallery}
            className="flex h-14 items-center justify-center rounded-2xl bg-white/15 text-2xl disabled:opacity-50"
            aria-label="Pick from gallery"
          >
            🖼️
          </button>

          {/* CaptureAndScanAsync */}
          <button
            disabled={isAnalyzing}
            onClick={openCamera}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-cream bg-sage-green text-3xl text-white disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-fab)" }}
            aria-label="Capture photo"
          >
            📸
          </button>

          {/* Demo analyze (browser camera unreliable in preview) */}
          <button
            disabled={isAnalyzing}
            onClick={() => void processPhoto(null)}
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
