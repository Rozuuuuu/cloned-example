import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fabricAdvice,
  deleteScan,
  getHulasPersona,
  getRecentScans,
  getScanImageUrl,
  getWeather,
  humidityLabel,
  loadHulasFromProfile,
  syncOfflineScans,
  type HulasLevel,
  type ScanRecord,
  type WeatherInfo,
} from "@/lib/habi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

const Dashboard = () => {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [hulas, setHulasState] = useState<HulasLevel>("pawisin");

  const refreshScans = async () => setScans(await getRecentScans(5));

  // Mirrors DashboardViewModel.LoadAsync — gate on auth, then load weather, profile, top-5 scans.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      setWeather(await getWeather("Consolacion, Cebu"));
      setHulasState(await loadHulasFromProfile());
      // Drain any offline drafts collected while disconnected.
      const synced = await syncOfflineScans();
      if (synced > 0) toast.success(`Synced ${synced} offline scan${synced > 1 ? "s" : ""}`);
      await refreshScans();
    })();

    const onOnline = async () => {
      const synced = await syncOfflineScans();
      if (synced > 0) {
        toast.success(`Back online — synced ${synced} scan${synced > 1 ? "s" : ""}`);
        await refreshScans();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [navigate]);

  const handleDelete = async (e: React.MouseEvent, s: ScanRecord) => {
    e.stopPropagation();
    if (!confirm(`Delete scan of ${s.fabricName}?`)) return;
    const ok = await deleteScan(s);
    if (ok) {
      toast.success("Scan deleted");
      await refreshScans();
    } else {
      toast.error("Could not delete scan");
    }
  };

  const { label: hulasLabel, advice: hulasAdvice } = getHulasPersona(hulas);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  if (!weather) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-deep-sage">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[#CCDDCB]">Good morning,</p>
            <p className="text-xl font-bold">Maria 👋</p>
          </div>
          <div className="flex gap-2.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 text-lg">🔔</div>
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 text-lg">👤</div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/20 bg-white/10 p-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-terracotta/40 text-2xl">
              ☀️
            </div>
            <div>
              <div className="text-xs text-[#CCDDCB]">{weather.location}</div>
              <div className="text-3xl font-bold leading-tight">{weather.temperature}°C</div>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-1">
                💧<span className="font-semibold">{humidityLabel(weather.humidity)}</span>
              </div>
              <div className="flex items-center gap-1 text-[#AACCAA]">
                💨<span>{weather.windSpeed} km/h</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-terracotta">
                🌡️<span>Feels {weather.feelsLike}°C</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#AACCAA]">Humidity Index</span>
              <span className="font-semibold text-terracotta">{fabricAdvice(weather.humidity)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-terracotta"
                style={{ width: `${weather.humidity}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 px-5 pb-56 pt-5">
        <div className="rounded-3xl bg-deep-sage p-5 text-cream">
          <div className="flex items-center gap-2">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-base">🔥</div>
            <span className="text-[11px] font-semibold tracking-[0.15em] text-[#AACCAA]">
              FABRIC PERSONA
            </span>
          </div>
          <div className="mt-2 text-[22px] font-bold">{hulasLabel}</div>
          <p className="mt-1 text-[13px] leading-6 text-[#CCDACC]">{hulasAdvice}</p>
          <button
            onClick={() => navigate("/onboarding")}
            className="mt-2 text-xs text-[#AACCAA]"
          >
            Change profile ›
          </button>
        </div>

        <div className="habi-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold text-deep-sage">Recent Scans</h2>
            <button
              onClick={() => navigate("/history")}
              className="text-sm font-semibold text-sage-green"
            >
              See all
            </button>
          </div>
          {scans.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No scans yet. Tap “Start Fabric Scan” to add your first item.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-border">
              {scans.map((s) => {
                const img = getScanImageUrl(s.imagePath);
                const isOffline = s.id.startsWith("offline:");
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/scan/${encodeURIComponent(s.id)}`)}
                    className="flex cursor-pointer items-center gap-3 py-2.5"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={s.fabricName}
                        className="h-11 w-11 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-green text-[13px] font-bold text-white">
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
                        {s.fiberType} · {formatDate(s.scannedAt)}
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

        <div className="rounded-3xl bg-deep-sage p-5 text-cream">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌿</span>
            <span className="font-bold">Eco Insights</span>
          </div>
          <div className="mt-3 space-y-3 text-[13px] text-[#CCDACC]">
            <div className="flex gap-3"><span>♻️</span><span>Basahan upcycle trending this week</span></div>
            <div className="flex gap-3"><span>🍃</span><span>Natural fibers reduce landfill by 40%</span></div>
            <div className="flex gap-3"><span>📈</span><span>Pre-loved linen value up +12% this season</span></div>
          </div>
        </div>
      </div>

      {/* Floating scan CTA + persistent bottom navigation */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 px-5">
        <button
          onClick={() => navigate("/scanner")}
          className="pointer-events-auto mx-auto block w-full max-w-md rounded-full border-[3px] border-cream bg-deep-sage px-7 py-4 text-[15px] font-bold text-cream"
          style={{ boxShadow: "var(--shadow-fab)" }}
        >
          📷 &nbsp;Start Fabric Scan
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
