import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteScan,
  getRecentScans,
  pruneImageCache,
  sortScans,
  syncOfflineScans,
  type ScanRecord,
} from "@/lib/habi";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useScanImages } from "@/hooks/use-scan-images";

const PAGE_SIZE = 20;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvCell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

const History = () => {
  const navigate = useNavigate();
  const { session, checked } = useAuthGuard();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    const next = await getRecentScans();
    setScans(next);
    pruneImageCache(next.map((s) => s.id));
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    (async () => {
      await syncOfflineScans();
      await refresh();
    })();
  }, [navigate, session]);

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

  // Reset paging whenever the visible filtered set changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, gradeFilter, scans.length]);

  const paged = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const hasMore = paged.length < filtered.length;
  const scanImages = useScanImages(paged);

  // Infinite scroll: load more when the sentinel comes into view.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => v + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, paged.length]);

  // Keyboard shortcuts:
  //  • Modal open → Enter confirms, Esc cancels (Radix already handles Esc but
  //    we lock both while a delete is in-flight to avoid double-fires).
  //  • Otherwise → "n" / "s" jumps to the scanner with capture focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (pendingDelete) {
        if (deleting) {
          if (e.key === "Enter" || e.key === "Escape") e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void confirmDelete();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPendingDelete(null);
        }
        return;
      }
      if (typing) return;
      if (e.key === "n" || e.key === "s" || e.key === "N" || e.key === "S") {
        e.preventDefault();
        navigate("/scanner", { state: { focusCapture: true } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete, deleting, navigate]);

  const exportScans = (format: "csv" | "json") => {
    // Re-sort defensively so exports always match the on-screen tie-break order
    // (newest scannedAt first; ties → offline drafts first, then id desc).
    const ordered = sortScans(filtered);
    if (ordered.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      const blob = new Blob([JSON.stringify(ordered, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `habi-scans-${stamp}.json`);
    } else {
      const header = ["id", "fabricName", "fiberType", "grade", "scannedAt", "imagePath"];
      const rows = ordered.map((s) =>
        [s.id, s.fabricName, s.fiberType, s.grade, s.scannedAt, s.imagePath ?? ""]
          .map((v) => csvCell(String(v)))
          .join(",")
      );
      const blob = new Blob([[header.join(","), ...rows].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      downloadBlob(blob, `habi-scans-${stamp}.csv`);
    }
    toast.success(`Exported ${ordered.length} scan${ordered.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Scan History</h1>
            <p className="mt-1 text-sm text-[#CCDDCB]">
              All your fabric scans, newest first.
            </p>
          </div>
          {scans.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => exportScans("csv")}
                className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-white/25"
                aria-label="Export scans as CSV"
              >
                ⬇ CSV
              </button>
              <button
                onClick={() => exportScans("json")}
                className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-white/25"
                aria-label="Export scans as JSON"
              >
                ⬇ JSON
              </button>
            </div>
          )}
        </div>
        <div
          aria-label="Keyboard shortcuts"
          className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-[#AACCAA]"
        >
          <span className="opacity-80">Shortcuts:</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-cream">N</kbd>
          <span>/</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-cream">S</kbd>
          <span className="opacity-80">new scan</span>
          <span className="opacity-50">·</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-cream">Enter</kbd>
          <span className="opacity-80">confirm delete</span>
          <span className="opacity-50">·</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-cream">Esc</kbd>
          <span className="opacity-80">cancel</span>
        </div>
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
            {paged.map((s) => {
              const img = scanImages[s.id];
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
            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-4 text-xs text-muted-foreground"
              >
                Loading more…
              </div>
            )}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                End of history · {filtered.length} scans
              </div>
            )}
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
        disabled={deleting}
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