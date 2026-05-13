import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheScanImage,
  compareScans,
  getCachedScanImage,
  getImageCacheLimit,
  sortScans,
  type ScanRecord,
} from "@/lib/habi";

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

describe("infinite-scroll pagination order", () => {
  it("page slices are always a prefix of the globally sorted list", () => {
    const records: ScanRecord[] = [];
    // Mix unique timestamps and intentional ties to exercise tie-breaking.
    for (let i = 0; i < 47; i++) {
      const ts = new Date(2026, 0, 1 + Math.floor(i / 3)).toISOString();
      records.push(make(`id-${String(i).padStart(3, "0")}`, ts));
    }
    records.push(make("offline:draft-1", new Date(2026, 0, 16).toISOString()));
    records.push(make("offline:draft-2", new Date(2026, 0, 16).toISOString()));

    const sorted = sortScans(records);
    const PAGE = 20;
    for (let visible = PAGE; visible <= sorted.length; visible += PAGE) {
      const page = sorted.slice(0, visible);
      // Prefix invariant: page[i] === sorted[i] for all i.
      page.forEach((s, i) => expect(s.id).toBe(sorted[i].id));
      // Re-sorting the page must not reorder it.
      expect(sortScans(page).map((s) => s.id)).toEqual(page.map((s) => s.id));
    }
  });
});

describe("LRU image cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enforces the 50-entry cap and evicts least-recently-used entries", () => {
    const cap = getImageCacheLimit();
    expect(cap).toBe(50);

    // Fill exactly to capacity.
    for (let i = 0; i < cap; i++) cacheScanImage(`id-${i}`, `url-${i}`);
    // All present.
    for (let i = 0; i < cap; i++) {
      expect(getCachedScanImage(`id-${i}`)).toBe(`url-${i}`);
    }

    // Touch id-0 so it becomes most-recently-used; id-1 is now LRU.
    expect(getCachedScanImage("id-0")).toBe("url-0");

    // Insert one more → must evict id-1 (oldest), keep id-0.
    cacheScanImage("new-1", "new-url-1");
    expect(getCachedScanImage("id-1")).toBeUndefined();
    expect(getCachedScanImage("id-0")).toBe("url-0");
    expect(getCachedScanImage("new-1")).toBe("new-url-1");

    // Add many more — total stored items must never exceed the cap.
    for (let i = 0; i < 30; i++) cacheScanImage(`extra-${i}`, `extra-url-${i}`);
    const raw = JSON.parse(localStorage.getItem("habi_image_cache") || "{}");
    expect(raw.order.length).toBeLessThanOrEqual(cap);
    expect(Object.keys(raw.items).length).toBeLessThanOrEqual(cap);
    expect(raw.order.length).toBe(Object.keys(raw.items).length);
  });
});