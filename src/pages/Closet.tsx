import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecentScans, type ScanRecord } from "@/lib/habi";

const Closet = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanRecord[]>([]);

  useEffect(() => {
    setScans(getRecentScans());
  }, []);

  return (
    <div className="min-h-screen bg-cream pb-32">
      <div className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
            aria-label="Back"
          >
            ←
          </button>
          <div>
            <p className="text-[13px] text-[#CCDDCB]">Your fabrics</p>
            <h1 className="text-xl font-bold">My Closet 👗</h1>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 pt-5">
        {scans.length === 0 && (
          <div className="habi-card text-center text-sm text-muted-foreground">
            No scans yet. Tap “Start Fabric Scan” to add your first item.
          </div>
        )}
        {scans.map((s) => (
          <div key={s.id} className="habi-card flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-green text-sm font-bold text-white">
              {s.grade}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-deep-sage">{s.fabricName}</div>
              <div className="text-xs text-muted-foreground">{s.fiberType}</div>
            </div>
            <span className="text-lg text-muted-foreground">›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Closet;