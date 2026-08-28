import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fabricAdvice,
  deleteScan,
  getHulasPersona,
  getRecentScans,
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
import { useScanImages } from "@/hooks/use-scan-images";

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
  const scanImages = useScanImages(scans);

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
  const today = formatDate(new Date().toISOString());

  const accountMenu = isLoading ? (
    <SpecimenSkeletonBlock className="h-11 w-11 rounded-full" />
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
        <div className="flex items-center gap-3 border-b-2 border-border p-4">
          <Avatar className="h-12 w-12">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-terracotta/40 text-sm font-bold text-cream">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{fullName}</div>
            {session?.user?.email && (
              <div className="type-caption truncate">{session.user.email}</div>
            )}
          </div>
        </div>
        <div className="space-y-1 p-2 text-sm">
          <div className="flex items-center justify-between px-3 py-2 text-muted-foreground">
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
            className="w-full px-3 py-2 text-left hover:bg-muted"
          >
            Edit fabric profile
          </button>
          {hasEmail && !hasGoogle && (
            <button
              onClick={handleLinkGoogle}
              className="w-full px-3 py-2 text-left hover:bg-muted"
            >
              Link Google account
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-left font-medium text-warning-red hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const weatherPlate = (
    <>
      <p className="type-label mb-3 text-terracotta">Fig. 01 — Ambient conditions</p>
      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
            <SpecimenSkeletonBlock className="h-[52px] w-[52px] border-2 border-cream/30" />
            <div className="space-y-2">
              <SpecimenSkeletonBlock className="h-3 w-32" />
              <SpecimenSkeletonBlock className="h-7 w-20" />
            </div>
            <div className="space-y-2">
              <SpecimenSkeletonBlock className="h-3 w-16" />
              <SpecimenSkeletonBlock className="h-3 w-16" />
              <SpecimenSkeletonBlock className="h-3 w-16" />
            </div>
          </div>
          <SpecimenSkeletonBlock className="h-1.5 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] items-center justify-center border-2 border-cream/40 bg-terracotta/40 text-2xl">
              ☀️
            </div>
            <div>
              <div className="type-label text-cream/70">{weather!.location}</div>
              <div className="type-h1">{weather!.temperature}°C</div>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-1">
                💧<span className="font-semibold">{humidityLabel(weather!.humidity)}</span>
              </div>
              <div className="flex items-center gap-1 text-cream/70">
                💨<span>{weather!.windSpeed} km/h</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-terracotta">
                🌡️<span>Feels {weather!.feelsLike}°C</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="type-mono text-cream/70">Humidity Index</span>
              <span className="type-label text-terracotta">{fabricAdvice(weather!.humidity)}</span>
            </div>
            <div className="mt-1 h-2 border-2 border-cream/40">
              <div className="h-full bg-terracotta" style={{ width: `${weather!.humidity}%` }} />
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <SpecimenGridLayout
      title={
        isLoading ? (
          <SpecimenSkeletonBlock className="h-8 w-56" />
        ) : (
          <span className="flex items-center gap-3">
            {accountMenu}
            <span className="min-w-0 break-words">Good morning {displayName}</span>
          </span>
        )
      }
      eyebrow={`Plate 01 · ${today}`}
      actions={
        <>
          {hasEmail && !hasGoogle && (
            <button
              onClick={handleLinkGoogle}
              aria-label="Link Google account"
              title="Link Google account"
              className="border-2 border-cream/50 px-3 py-2 text-lg hover:bg-cream/20"
            >
              🔗
            </button>
          )}
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="border-2 border-cream/50 px-3 py-2 text-lg hover:bg-cream/20"
          >
            🚪
          </button>
        </>
      }
      mastheadExtra={weatherPlate}
      contentClassName="grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6"
    >
      <div className="flex h-full flex-col border-2 border-deep-sage bg-deep-sage p-4 text-cream sm:p-5 md:p-6">
        <div className="flex items-center gap-2 border-b-2 border-cream/30 pb-2">
          <span className="type-mono text-terracotta">02</span>
          <span className="type-label text-terracotta">Fabric Persona</span>
        </div>
        <div className="type-h1 mt-3">{hulasLabel}</div>
        <p className="type-body mt-1 flex-1 text-cream/80">{hulasAdvice}</p>
        <button onClick={() => navigate("/onboarding")} className="type-label mt-2 text-terracotta">
          Change profile ›
        </button>
      </div>

      <div className="habi-card flex h-full flex-col p-4 sm:p-5 md:p-6 lg:row-span-2">
        <div className="flex items-center justify-between border-b-2 border-deep-sage pb-2">
          <h2 className="type-h2 text-deep-sage">Recent Scans</h2>
          <button onClick={() => navigate("/history")} className="type-label text-sage-green">
            See all →
          </button>
        </div>
        {isLoading ? (
          <div className="mt-3">
            <SpecimenSkeletonList rows={3} label="Developing plate 02" />
          </div>
        ) : scans.length === 0 ? (
          <div className="mt-3">
            <SpecimenEmpty
              index="02"
              title="No fibers catalogued"
              note="Your five most recent specimens print here. Capture a swatch and Habi-Check files it under the index."
              action={
                <button
                  onClick={() => navigate("/scanner")}
                  className="border-2 border-deep-sage bg-terracotta px-5 py-3 font-display text-xl uppercase text-deep-sage"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  Start Fabric Scan →
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-2 divide-y-2 divide-deep-sage/15">
            {scans.map((s) => {
              const img = scanImages[s.id];
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
                      className="h-11 w-11 border-2 border-deep-sage object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center border-2 border-deep-sage bg-sage-green font-display text-lg text-cream">
                      {s.grade}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      {s.fabricName}
                      {isOffline && (
                        <span className="type-mono ml-2 border-2 border-terracotta px-1.5 py-0.5 text-terracotta">
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="type-caption">
                      {s.fiberType} · {formatDate(s.scannedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, s)}
                    aria-label={`Delete scan of ${s.fabricName}`}
                    className="px-2 py-1 text-lg text-muted-foreground hover:text-terracotta"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex h-full flex-col border-2 border-deep-sage bg-sage-green p-4 text-cream sm:p-5 md:p-6">
        <div className="flex items-center gap-2 border-b-2 border-cream/40 pb-2">
          <span className="type-mono">03</span>
          <span className="type-label">Field Notes</span>
        </div>
        <div className="type-body mt-3 divide-y-2 divide-cream/25">
          <p className="py-2">Basahan upcycle trending this week</p>
          <p className="py-2">Natural fibers reduce landfill by 40%</p>
          <p className="py-2">Pre-loved linen value up +12% this season</p>
        </div>
      </div>

      {/* Floating scan CTA */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 px-5">
        <button
          onClick={() => navigate("/scanner")}
          className="pointer-events-auto mx-auto block w-full max-w-md border-2 border-deep-sage bg-terracotta px-7 py-4 font-display text-2xl uppercase tracking-tight text-deep-sage"
          style={{ boxShadow: "var(--shadow-fab)" }}
        >
          Start Fabric Scan →
        </button>
      </div>
    </SpecimenGridLayout>
  );
};


export default Dashboard;
