import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  buildFabricResult,
  deleteScan,
  getScanById,
  resolveScanImage,
  type ScanRecord,
} from "@/lib/habi";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

/** Scan result detail — mirrors ResultPage but loads a saved record by id. */
const ScanDetail = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const scanId = decodeURIComponent(id);
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const found = await getScanById(scanId);
      setScan(found);
      setLoading(false);
    })();
  }, [scanId]);

  // Same mapping ResultViewModel uses: A+ ⇒ success, anything else ⇒ fail copy.
  const isSuccess = scan?.grade?.startsWith("A") ?? true;
  const fabric = useMemo(
    () => buildFabricResult(isSuccess ? "success" : "fail"),
    [isSuccess]
  );

  const imageUrl = resolveScanImage(scan);
  const gradient = isSuccess ? "var(--gradient-success)" : "var(--gradient-fail)";
  const gradeColor = isSuccess ? "#7BA05B" : "#D84545";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-deep-sage">
        Loading...
      </div>
    );
  }
  if (!scan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream text-deep-sage">
        <p className="text-sm">Scan not found.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const onDelete = async () => {
    if (!scan || deleting) return;
    setDeleting(true);
    try {
      const ok = await deleteScan(scan);
      if (ok) {
        toast.success("Scan deleted");
        setConfirmOpen(false);
        navigate("/history");
      } else {
        toast.error("Could not delete scan");
      }
    } catch {
      toast.error("Could not delete scan");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: gradient }}>
      <div className="px-5 pb-10 pt-12">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
            aria-label="Back"
          >
            ←
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl"
            aria-label="Delete scan"
          >
            🗑️
          </button>
        </div>

        {imageUrl && (
          <div className="mx-auto mt-4 h-40 w-40 overflow-hidden rounded-3xl border-2 border-white/30">
            <img
              src={imageUrl}
              alt={scan.fabricName}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div
          className="mx-auto mt-5 flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white"
          style={{ boxShadow: "0 10px 20px rgba(0,0,0,0.25)" }}
        >
          <span className="text-[42px] font-bold leading-none" style={{ color: gradeColor }}>
            {scan.grade}
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-[#888]">GRADE</span>
        </div>

        <div className="mt-3 text-center">
          <h1 className="text-2xl font-bold">{scan.fabricName}</h1>
          <p className="text-sm opacity-80">{scan.fiberType}</p>
          <p className="mt-1 text-xs opacity-70">
            Scanned {new Date(scan.scannedAt).toLocaleString()}
          </p>
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

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this scan?"
        description={`“${scan.fabricName}” will be permanently removed.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        disabled={deleting}
        onConfirm={onDelete}
        onOpenChange={(o) => {
          if (deleting) return;
          setConfirmOpen(o);
        }}
      />
    </div>
  );
};

export default ScanDetail;