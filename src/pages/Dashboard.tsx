import { useEffect, useRef, useState } from "react";
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
import { signOutEverywhere, useAuthGuard } from "@/hooks/use-auth-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDisplayName, getInitials } from "@/lib/display-name";

const Dashboard = () => {
  const navigate = useNavigate();
  const { session, checked } = useAuthGuard();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [hulas, setHulasState] = useState<HulasLevel>("pawisin");
  // Guard so we surface at most one toast per reconnect cycle (or initial load).
  // Reset to `false` on the `offline` event so the next reconnect can toast again.
  const syncingRef = useRef(false);
  const reportedRef = useRef(false);

  const reportSync = (
    r: { synced: number; imageFailures: number; failed: number; remaining: number },
    prefix: string
  ) => {
    if (reportedRef.current) return;
    if (r.synced === 0 && r.imageFailures === 0 && r.failed === 0) return;
    reportedRef.current = true;
    if (r.synced > 0) {
      toast.success(
        `${prefix}synced ${r.synced} scan${r.synced > 1 ? "s" : ""}` +
          (r.remaining > 0 ? ` · ${r.remaining} still queued` : "")
      );
    }
    if (r.imageFailures > 0) {
      toast.warning(
        `${r.imageFailures} image${r.imageFailures > 1 ? "s" : ""} couldn't upload — scan saved without photo.`
      );
    }
    if (r.failed > 0 && r.synced === 0) {
      toast.error(`${r.failed} scan${r.failed > 1 ? "s" : ""} still pending — will retry.`);
    }
  };

  const runSync = async (prefix: string) => {
    if (syncingRef.current) return null;
    syncingRef.current = true;
    try {
      const r = await syncOfflineScans();
      reportSync(r, prefix);
      return r;
    } finally {
      syncingRef.current = false;
    }
  };

  const refreshScans = async () => setScans(await getRecentScans(5));

  // Mirrors DashboardViewModel.LoadAsync — gate on auth, then load weather, profile, top-5 scans.
  useEffect(() => {
    if (!session) return;
    (async () => {
      setWeather(await getWeather("Consolacion, Cebu"));
      setHulasState(await loadHulasFromProfile());
      // Drain any offline drafts collected while disconnected.
      await runSync("");
      await refreshScans();
    })();

    const onOnline = async () => {
      // Reset the per-reconnect guard so this event can produce one toast.
      reportedRef.current = false;
      const r = await runSync("Back online — ");
      if (r && r.synced > 0) await refreshScans();
    };
    const onOffline = () => {
      // Arm the guard for the next reconnect.
      reportedRef.current = false;
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [navigate, session]);

  const handleLogout = async () => {
    await signOutEverywhere();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  const handleLinkGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(`Couldn't link Google: ${(err as Error).message}`);
    }
  };

  const identities = session?.user?.identities ?? [];
  const hasGoogle = identities.some((i) => i.provider === "google");
  const hasEmail = identities.some((i) => i.provider === "email");

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

  const displayName = getDisplayName(session?.user ?? null);

  const avatarUrl = (() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const v = meta.avatar_url ?? meta.picture;
    return typeof v === "string" && v ? v : undefined;
  })();
  const initials = getInitials(displayName);

  const fullName = (() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    for (const k of ["full_name", "name", "display_name"]) {
      const v = meta[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return displayName;
  })();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  const isLoading = !checked || !weather;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="rounded-b-[28px] bg-deep-sage px-4 pb-6 pt-10 text-cream sm:px-6 sm:pt-12 md:px-8 md:pb-8 md:pt-14 lg:px-10 lg:pt-16">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/20 sm:h-11 sm:w-11" />
            ) : (
              <Popover>
                <PopoverTrigger
                  aria-label="Open account menu"
                  className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-deep-sage transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Avatar className="h-11 w-11 ring-2 ring-white/30">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-terracotta/40 text-sm font-bold text-cream">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={8} className="w-72 p-0">
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <Avatar className="h-12 w-12">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-terracotta/40 text-sm font-bold text-cream">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {fullName}
                      </div>
                      {session?.user?.email && (
                        <div className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 p-2 text-sm">
                    <div className="flex items-center justify-between rounded-md px-3 py-2 text-muted-foreground">
                      <span>Signed in with</span>
                      <span className="font-medium text-foreground">
                        {hasGoogle && hasEmail
                          ? "Google + Email"
                          : hasGoogle
                            ? "Google"
                            : hasEmail
                              ? "Email"
                              : "—"}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/onboarding")}
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      Edit fabric profile
                    </button>
                    {hasEmail && !hasGoogle && (
                      <button
                        onClick={handleLinkGoogle}
                        className="w-full rounded-md px-3 py-2 text-left hover:bg-muted"
                      >
                        Link Google account
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-md px-3 py-2 text-left font-medium text-warning-red hover:bg-muted"
                    >
                      Sign out
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isLoading ? (
              <Skeleton className="h-7 w-40 bg-white/20 sm:w-56" />
            ) : (
              <p className="min-w-0 flex-1 truncate text-lg font-bold sm:text-xl md:text-2xl">
                <span className="whitespace-nowrap">Good morning </span>
                <span className="break-words">{displayName}</span>
                <span className="whitespace-nowrap"> 👋</span>
              </p>
            )}
          </div>
          <div className="flex gap-2.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 text-lg">🔔</div>
            {hasEmail && !hasGoogle && (
              <button
                onClick={handleLinkGoogle}
                aria-label="Link Google account"
                title="Link Google account"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 text-lg hover:bg-white/30"
              >
                🔗
              </button>
            )}
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 text-lg hover:bg-white/30"
            >
              🚪
            </button>
          </div>
        </div>

        <div className="mx-auto mt-4 w-full max-w-6xl rounded-3xl border border-white/20 bg-white/10 p-4 sm:p-5 md:mt-6 md:p-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
              <Skeleton className="h-[52px] w-[52px] rounded-2xl bg-white/20" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32 bg-white/20" />
                <Skeleton className="h-7 w-20 bg-white/20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 bg-white/20" />
                <Skeleton className="h-3 w-16 bg-white/20" />
                <Skeleton className="h-3 w-16 bg-white/20" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full bg-white/20" />
          </div>
        ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-terracotta/40 text-2xl">
              ☀️
            </div>
            <div>
              <div className="text-xs text-[#CCDDCB]">{weather!.location}</div>
              <div className="text-3xl font-bold leading-tight">{weather!.temperature}°C</div>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-1">
                💧<span className="font-semibold">{humidityLabel(weather!.humidity)}</span>
              </div>
              <div className="flex items-center gap-1 text-[#AACCAA]">
                💨<span>{weather!.windSpeed} km/h</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-terracotta">
                🌡️<span>Feels {weather!.feelsLike}°C</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#AACCAA]">Humidity Index</span>
              <span className="font-semibold text-terracotta">{fabricAdvice(weather!.humidity)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-terracotta"
                style={{ width: `${weather!.humidity}%` }}
              />
            </div>
          </div>
        </>
        )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto grid w-full max-w-6xl auto-rows-fr grid-cols-1 items-stretch gap-4 px-4 pb-56 pt-5 sm:gap-5 sm:px-6 md:gap-5 md:px-8 md:pb-32 lg:grid-cols-2 lg:gap-6 lg:px-10">
        <div className="flex h-full flex-col rounded-3xl bg-deep-sage p-4 text-cream sm:p-5 md:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-base">🔥</div>
            <span className="text-[11px] font-semibold tracking-[0.15em] text-[#AACCAA]">
              FABRIC PERSONA
            </span>
          </div>
          <div className="mt-2 text-[22px] font-bold">{hulasLabel}</div>
          <p className="mt-1 flex-1 text-[13px] leading-6 text-[#CCDACC]">{hulasAdvice}</p>
          <button
            onClick={() => navigate("/onboarding")}
            className="mt-2 text-xs text-[#AACCAA]"
          >
            Change profile ›
          </button>
        </div>

        <div className="habi-card flex h-full flex-col p-4 sm:p-5 md:p-6 lg:row-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold text-deep-sage">Recent Scans</h2>
            <button
              onClick={() => navigate("/history")}
              className="text-sm font-semibold text-sage-green"
            >
              See all
            </button>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : scans.length === 0 ? (
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

        <div className="flex h-full flex-col rounded-3xl bg-deep-sage p-4 text-cream sm:p-5 md:p-6">
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
