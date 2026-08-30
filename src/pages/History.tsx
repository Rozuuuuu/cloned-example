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
import SpecimenGridLayout from "@/components/SpecimenGridLayout";
import { SpecimenEmpty, SpecimenSkeletonList } from "@/components/SpecimenStates";
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
    <SpecimenGridLayout
      title="Scan History"
      eyebrow="All your fabric scans, newest first."
      actions={
        scans.length > 0 ? (
          <>
            <button
              onClick={() => exportScans("csv")}
              className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
              aria-label="Export scans as CSV"
            >
              ↓ CSV
            </button>
            <button
              onClick={() => exportScans("json")}
              className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
              aria-label="Export scans as JSON"
            >
              ↓ JSON
            </button>
          </>
        ) : undefined
      }
      mastheadExtra={
        <div
          aria-label="Keyboard shortcuts"
          className="flex flex-wrap items-center gap-2 text-cream"
        >
          <span className="type-mono text-terracotta">Shortcuts</span>
          <kbd className="type-mono border-2 border-cream/50 px-1.5">N</kbd>
          <kbd className="type-mono border-2 border-cream/50 px-1.5">S</kbd>
          <span className="type-label">new scan</span>
          <span className="opacity-40">·</span>
          <kbd className="type-mono border-2 border-cream/50 px-1.5">Enter</kbd>
          <span className="type-label">confirm delete</span>
          <span className="opacity-40">·</span>
          <kbd className="type-mono border-2 border-cream/50 px-1.5">Esc</kbd>
          <span className="type-label">cancel</span>
        </div>
      }
    >
      {!loading && scans.length > 0 && (
        <div className="mb-5 space-y-3 border-2 border-deep-sage bg-card p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, fiber, or grade…"
            className="border-2 border-deep-sage bg-transparent"
          />
          <div className="flex flex-wrap gap-0">
            {["all", ...grades].map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`type-label -ml-[2px] border-2 border-deep-sage px-3 py-2 transition-colors first:ml-0 ${
                  gradeFilter === g
                    ? "bg-deep-sage text-cream"
                    : "bg-transparent text-deep-sage hover:bg-terracotta/25"
                }`}
              >
                {g === "all" ? "All grades" : `Grade ${g}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <SpecimenSkeletonList rows={4} label="Retrieving closet" />
      ) : scans.length === 0 ? (
        <SpecimenEmpty
          index="00"
          title="No specimens catalogued"
          note="Scan a fabric and it will be filed here with its grade, fiber and capture date."
          action={
            <Button
              onClick={() => navigate("/scanner", { state: { focusCapture: true } })}
              className="type-h3 h-auto border-2 border-deep-sage bg-deep-sage px-6 py-3 text-cream hover:bg-sage-green"
            >
              Start scanning →
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <SpecimenEmpty
          index="—"
          title="No match in this drawer"
          note="No scans match your search or grade filter. Clear the filters to see the full closet."
        />
      ) : (
        <div className="border-2 border-deep-sage bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between border-b-2 border-deep-sage px-4 py-2">
            <span className="type-mono text-sage-green">Catalogue</span>
            <span className="type-mono text-sage-green">{filtered.length} entries</span>
          </div>
          <div className="divide-y-2 divide-deep-sage/15">
            {paged.map((s, i) => {
              const img = scanImages[s.id];
              const isOffline = s.id.startsWith("offline:");
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/scan/${encodeURIComponent(s.id)}`)}
                  className="flex cursor-pointer items-center gap-4 px-4 py-4 transition-colors hover:bg-terracotta/10"
                >
                  <span className="type-mono w-6 shrink-0 text-sage-green/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {img ? (
                    <img
                      src={img}
                      alt={s.fabricName}
                      loading="lazy"
                      className="h-12 w-12 shrink-0 border-2 border-deep-sage object-cover"
                    />
                  ) : (
                    <div className="type-h3 flex h-12 w-12 shrink-0 items-center justify-center border-2 border-deep-sage bg-sage-green text-cream">
                      {s.grade}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="type-h3 flex flex-wrap items-center gap-2 text-deep-sage">
                      {s.fabricName}
                      {isOffline && (
                        <span className="type-mono border-2 border-terracotta px-1.5 text-terracotta">
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="type-label text-sage-green">
                      {s.fiberType} · Grade {s.grade}
                    </div>
                    <div className="type-mono text-muted-foreground">
                      {formatDate(s.scannedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, s)}
                    disabled={deleting}
                    aria-label={`Delete scan of ${s.fabricName}`}
                    className="type-label border-2 border-deep-sage px-2 py-1 text-deep-sage transition-colors hover:bg-warning-red hover:text-cream disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="type-mono flex items-center justify-center py-4 text-sage-green"
              >
                Loading more…
              </div>
            )}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <div className="type-mono py-3 text-center text-sage-green">
                End of history · {filtered.length} scans
              </div>
            )}
          </div>
        </div>
      )}

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
    </SpecimenGridLayout>
  );
};

export default History;
