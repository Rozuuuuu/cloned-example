import { buildFabricResult, type ScanRecord } from "@/lib/habi";

/** Grades A–C are "good" specimens, everything else fails — same rule the Result page uses. */
export const isGoodGrade = (grade: string) => /^[ABC]/i.test(grade.trim());

/** Grade → the same metric set the Result page prints, so rows stay identical. */
export const metricsFor = (grade: string) => {
  const base = buildFabricResult(isGoodGrade(grade) ? "success" : "fail");
  return { breathability: base.breathability, sustainability: base.sustainability };
};

export type CountBucket = { key: string; count: number };

export interface CatalogStats {
  total: number;
  good: number;
  poor: number;
  avgBreathability: number;
  avgSustainability: number;
  byGrade: CountBucket[];
  byFiber: CountBucket[];
  breathabilityBands: CountBucket[];
}

const tally = (values: string[]): CountBucket[] => {
  const map = new Map<string, number>();
  values.forEach((v) => map.set(v, (map.get(v) ?? 0) + 1));
  return Array.from(map, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key)
  );
};

/** Totals + chart buckets for the catalog dashboard. */
export const buildCatalogStats = (scans: ScanRecord[]): CatalogStats => {
  const total = scans.length;
  const good = scans.filter((s) => isGoodGrade(s.grade)).length;
  const breath = scans.map((s) => metricsFor(s.grade).breathability);
  const sustain = scans.map((s) => metricsFor(s.grade).sustainability);
  const avg = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

  const bands = [
    { key: "0–25%", test: (n: number) => n <= 25 },
    { key: "26–50%", test: (n: number) => n > 25 && n <= 50 },
    { key: "51–75%", test: (n: number) => n > 50 && n <= 75 },
    { key: "76–100%", test: (n: number) => n > 75 },
  ];

  return {
    total,
    good,
    poor: total - good,
    avgBreathability: avg(breath),
    avgSustainability: avg(sustain),
    byGrade: tally(scans.map((s) => s.grade.trim().toUpperCase() || "—")),
    byFiber: tally(scans.map((s) => s.fiberType.trim() || "Unspecified")).slice(0, 6),
    breathabilityBands: bands.map((b) => ({
      key: b.key,
      count: breath.filter(b.test).length,
    })),
  };
};
