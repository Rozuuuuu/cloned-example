import { describe, it, expect } from "vitest";
import { compareScans, sortScans, type ScanRecord } from "@/lib/habi";

const make = (id: string, scannedAt: string): ScanRecord => ({
  id,
  fabricName: "x",
  grade: "A+",
  fiberType: "y",
  scannedAt,
});

describe("scan ordering", () => {
  it("sorts by scannedAt descending", () => {
    const a = make("a", "2026-01-01T00:00:00Z");
    const b = make("b", "2026-02-01T00:00:00Z");
    const c = make("c", "2026-03-01T00:00:00Z");
    expect(sortScans([a, b, c]).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks ties with offline drafts first, then id desc", () => {
    const ts = "2026-01-01T00:00:00Z";
    const remote1 = make("11111111-1111-1111-1111-111111111111", ts);
    const remote2 = make("22222222-2222-2222-2222-222222222222", ts);
    const offline = make("offline:zzz", ts);
    const sorted = sortScans([remote1, offline, remote2]).map((s) => s.id);
    expect(sorted[0]).toBe("offline:zzz");
    // id desc among remote ties
    expect(sorted.slice(1)).toEqual([
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111",
    ]);
  });

  it("compareScans is consistent with sortScans", () => {
    const ts = "2026-01-01T00:00:00Z";
    const a = make("offline:a", ts);
    const b = make("zzz", ts);
    expect(compareScans(a, b)).toBeLessThan(0);
    expect(compareScans(b, a)).toBeGreaterThan(0);
    expect(compareScans(a, a)).toBe(0);
  });
});