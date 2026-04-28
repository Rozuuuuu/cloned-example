import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fabricAdvice,
  getHulas,
  getRecentScans,
  getWeather,
  humidityLabel,
  type ScanRecord,
  type WeatherInfo,
} from "@/lib/habi";

const Dashboard = () => {
  const navigate = useNavigate();
  const [weather] = useState<WeatherInfo>(getWeather());
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const hulas = getHulas();

  useEffect(() => {
    setScans(getRecentScans());
  }, []);

  const hulasLabel = hulas === "pawisin" ? "Pawisin Profile" : "Normal Profile";
  const hulasAdvice =
    hulas === "pawisin"
      ? "We'll favor breathable, moisture-wicking natural fabrics for you."
      : "Balanced fabric recommendations tailored to the day's weather.";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

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

        {/* Weather card */}
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
      <div className="space-y-4 px-5 pb-40 pt-5">
        {/* Fabric persona card */}
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

        {/* Recent scans */}
        <div className="habi-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold text-deep-sage">Recent Scans</h2>
            <span className="text-sm font-semibold text-sage-green">See all</span>
          </div>
          <div className="mt-2 divide-y divide-border">
            {scans.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-green text-[13px] font-bold text-white">
                  {s.grade}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{s.fabricName}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(s.scannedAt)}</div>
                </div>
                <span className="text-lg text-muted-foreground">›</span>
              </div>
            ))}
          </div>
        </div>

        {/* Eco insights */}
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

      {/* Bottom bar + FAB */}
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="relative">
          <button
            onClick={() => navigate("/scanner")}
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-[3px] border-cream bg-deep-sage px-7 py-3.5 text-[15px] font-bold text-cream"
            style={{ boxShadow: "var(--shadow-fab)" }}
          >
            📷 &nbsp;Start Fabric Scan
          </button>
          <div className="grid grid-cols-3 bg-white pb-6 pt-9">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">🏠</span>
              <span className="text-[10px] font-semibold text-deep-sage">Home</span>
              <span className="h-1 w-1 rounded-full bg-deep-sage" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">👗</span>
              <span className="text-[10px] text-[#B0A99A]">My Closet</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">🗺️</span>
              <span className="text-[10px] text-[#B0A99A]">Eco-Map</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;