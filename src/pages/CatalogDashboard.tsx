import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SpecimenGridLayout from "@/components/SpecimenGridLayout";
import { SpecimenEmpty, SpecimenSkeletonList } from "@/components/SpecimenStates";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { buildCatalogStats, isGoodGrade } from "@/lib/catalog";
import { getRecentScans, type ScanRecord } from "@/lib/habi";

const INK = "hsl(var(--deep-sage))";
const MOSS = "hsl(var(--sage-green))";
const CLAY = "hsl(var(--terracotta))";
const RED = "hsl(var(--warning-red))";

const Plate = ({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section
    className="border-2 border-deep-sage bg-card"
    style={{ boxShadow: "var(--shadow-card)" }}
    aria-label={title}
  >
    <header className="flex items-baseline justify-between border-b-2 border-deep-sage px-4 py-2">
      <span className="type-mono text-sage-green">{index}</span>
      <span className="type-h3 text-deep-sage">{title}</span>
    </header>
    <div className="p-4">{children}</div>
  </section>
);

const CatalogDashboard = () => {
  const navigate = useNavigate();
  const { session, checked } = useAuthGuard();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setScans(await getRecentScans());
      setLoading(false);
    })();
  }, [session]);

  const stats = useMemo(() => buildCatalogStats(scans), [scans]);

  const totals = [
    { label: "Specimens", value: stats.total },
    { label: "Breathable grades", value: stats.good },
    { label: "Poor grades", value: stats.poor },
    { label: "Avg breathability", value: `${stats.avgBreathability}%` },
    { label: "Avg sustainability", value: `${stats.avgSustainability}%` },
  ];

  return (
    <SpecimenGridLayout
      title="Catalog Dashboard"
      eyebrow={`Plate 05 · ${stats.total} specimens measured`}
      actions={
        <button
          onClick={() => navigate("/catalog")}
          className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
        >
          ← Catalog
        </button>
      }
    >
      {loading || !checked ? (
        <SpecimenSkeletonList rows={3} label="Measuring catalog" />
      ) : stats.total === 0 ? (
        <SpecimenEmpty
          index="05"
          title="Nothing to measure yet"
          note="Add specimens in the catalog and this plate fills with grade, fiber and breathability breakdowns."
        />
      ) : (
        <div className="space-y-5">
          <div
            className="grid grid-cols-2 border-2 border-deep-sage md:grid-cols-5"
            style={{ boxShadow: "var(--shadow-card)" }}
            data-testid="catalog-totals"
          >
            {totals.map((t) => (
              <div
                key={t.label}
                className="border-b-2 border-r-2 border-deep-sage bg-card p-4 last:border-r-0"
              >
                <div className="type-mono text-sage-green">{t.label}</div>
                <div className="type-h1 text-deep-sage">{t.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Plate index="01" title="By grade">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byGrade.map((g) => ({ name: g.key, count: g.count }))}>
                  <CartesianGrid stroke={INK} strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" stroke={INK} tickLine={false} />
                  <YAxis allowDecimals={false} stroke={INK} tickLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--terracotta) / 0.15)" }} />
                  <Bar dataKey="count" isAnimationActive={false}>
                    {stats.byGrade.map((g) => (
                      <Cell key={g.key} fill={isGoodGrade(g.key) ? MOSS : RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Plate>

            <Plate index="02" title="Breathability bands">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats.breathabilityBands.map((b) => ({ name: b.key, count: b.count }))}
                >
                  <CartesianGrid stroke={INK} strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" stroke={INK} tickLine={false} />
                  <YAxis allowDecimals={false} stroke={INK} tickLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--terracotta) / 0.15)" }} />
                  <Bar dataKey="count" fill={INK} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Plate>

            <Plate index="03" title="By fiber">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={stats.byFiber.map((f) => ({ name: f.key, value: f.count }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    isAnimationActive={false}
                    stroke={INK}
                    strokeWidth={2}
                  >
                    {stats.byFiber.map((f, i) => (
                      <Cell key={f.key} fill={[MOSS, CLAY, INK, RED][i % 4]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </Plate>

            <Plate index="04" title="Fiber tally">
              <ul className="divide-y-2 divide-deep-sage/20">
                {stats.byFiber.map((f) => (
                  <li key={f.key} className="flex items-baseline justify-between py-2">
                    <span className="type-body text-deep-sage">{f.key}</span>
                    <span className="type-h3 text-sage-green">{f.count}</span>
                  </li>
                ))}
              </ul>
            </Plate>
          </div>
        </div>
      )}
    </SpecimenGridLayout>
  );
};

export default CatalogDashboard;
