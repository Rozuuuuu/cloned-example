import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteScan,
  getRecentScans,
  getScanImageUrl,
  syncOfflineScans,
  type ScanRecord,
} from "@/lib/habi";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

const History = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setScans(await getRecentScans());
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

  const handleDelete = async (e: React.MouseEvent, s: ScanRecord) => {
    e.stopPropagation();
    if (!confirm(`Delete scan of ${s.fabricName}?`)) return;
    if (await deleteScan(s)) {
      toast.success("Scan deleted");
      await refresh();
    } else {
      toast.error("Could not delete scan");
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

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="mt-1 text-sm text-[#CCDDCB]">All your fabric scans, newest first.</p>
      </header>

      <div className="px-5 pt-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : scans.length === 0 ? (
          <div className="habi-card text-center">
            <p className="text-sm text-muted-foreground">
              No scans yet. Tap the Scan tab to add your first item.
            </p>
          </div>
        ) : (
          <div className="habi-card divide-y divide-border">
            {scans.map((s) => {
              const img = getScanImageUrl(s.imagePath);
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
                    aria-label={`Delete scan of ${s.fabricName}`}
                    className="rounded-full px-2 py-1 text-lg text-muted-foreground hover:text-terracotta"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default History;