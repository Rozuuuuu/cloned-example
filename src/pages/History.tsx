import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteScan,
  getRecentScans,
  pruneImageCache,
  resolveScanImage,
  syncOfflineScans,
  type ScanRecord,
} from "@/lib/habi";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const History = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    const next = await getRecentScans();
    setScans(next);
    pruneImageCache(next.map((s) => s.id));
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      await syncOfflineScans();
      await refresh();
    })();
  }, [navigate]);

  const handleDelete = (e: React.MouseEvent, s: ScanRecord) => {
    e.stopPropagation();
    if (deleting) return;
    setPendingDelete(s);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      const ok = await deleteScan(target);
      if (ok) {
        toast.success("Scan deleted");
        setPendingDelete(null);
        await refresh();
      } else {
        toast.error("Could not delete scan");
        // keep modal open so the user can retry — but don't double-fire
      }
    } catch {
      toast.error("Could not delete scan");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const grades = useMemo(() => {
    const set = new Set<string>();
    scans.forEach((s) => s.grade && set.add(s.grade.charAt(0).toUpperCase()));
    return Array.from(set).sort();
  }, [scans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans.filter((s) => {
      if (gradeFilter !== "all" && !s.grade?.toUpperCase().startsWith(gradeFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        s.fabricName.toLowerCase().includes(q) ||
        s.fiberType.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q)
      );
    });
  }, [scans, query, gradeFilter]);

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="mt-1 text-sm text-[#CCDDCB]">All your fabric scans, newest first.</p>
      </header>

      <div className="px-5 pt-5">
        {!loading && scans.length > 0 && (
          <div className="mb-4 space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, fiber, or grade…"
              className="rounded-full border-deep-sage/20 bg-white"
            />
            <div className="flex flex-wrap gap-2">
              {["all", ...grades].map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    gradeFilter === g
                      ? "bg-deep-sage text-cream"
                      : "bg-white text-deep-sage border border-deep-sage/20"
                  }`}
                >
                  {g === "all" ? "All grades" : `Grade ${g}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : scans.length === 0 ? (
          <div className="habi-card flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage-green/15 text-4xl">
              📷
            </div>
            <div>
              <h2 className="text-lg font-bold text-deep-sage">No scans yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan a fabric to see your history here.
              </p>
            </div>
            <Button
              onClick={() =>
                navigate("/scanner", { state: { focusCapture: true } })
              }
              className="rounded-full bg-deep-sage px-6 text-cream hover:bg-deep-sage/90"
            >
              Start scanning
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="habi-card text-center">
            <p className="text-sm text-muted-foreground">No scans match your search.</p>
          </div>
        ) : (
          <div className="habi-card divide-y divide-border">
            {filtered.map((s) => {
              const img = resolveScanImage(s);
              const isOffline = s.id.startsWith("offline:");
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/scan/${encodeURIComponent(s.id)}`)}
                  className="flex cursor-pointer items-center gap-3 py-3"
                >
                  {img ? (
                    <img
                      src={img}
                      alt={s.fabricName}
                      loading="lazy"
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-green text-sm font-bold text-white">
                      {s.grade}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      {s.fabricName}
                      {isOffline && (
                        <span className="ml-2 rounded-full bg-terracotta/20 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.fiberType} · Grade {s.grade}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(s.scannedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, s)}
                    disabled={deleting}
                    aria-label={`Delete scan of ${s.fabricName}`}
                    className="rounded-full px-2 py-1 text-lg text-muted-foreground hover:text-terracotta disabled:opacity-40"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this scan?"
        description={
          pendingDelete
            ? `“${pendingDelete.fabricName}” will be permanently removed.`
            : undefined
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirmDelete}
        onOpenChange={(o) => {
          if (deleting) return; // lock modal during delete
          if (!o) setPendingDelete(null);
        }}
      />

      <BottomNav />
    </div>
  );
};

export default History;