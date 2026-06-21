import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock state so vi.mock factory can reach it.
const { rpc, from, select, eq, order1, order2, range, invoke, getUser } = vi.hoisted(() => {
  const range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
  const order2 = vi.fn(() => ({ range, then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(cb) }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const eq = vi.fn(() => ({ order: order1, eq: () => ({ order: order1 }) }));
  const select = vi.fn(() => ({ eq, order: order1 }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const invoke = vi
    .fn()
    .mockResolvedValue({ data: { ok: true, ingested: 3 }, error: null });
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } } });
  return { rpc, from, select, eq, order1, order2, range, invoke, getUser };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from, functions: { invoke }, auth: { getUser } },
}));

import {
  getScanFindings,
  getConnectorFindings,
  logAuditEvent,
  rescanAndReview,
  severityRank,
  syncConnectorFindings,
  severityRationale,
  toFindingsCsv,
  clearSecurityCache,
} from "@/lib/security";

beforeEach(() => {
  rpc.mockClear();
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  order1.mockClear();
  order2.mockClear();
  range.mockClear();
  invoke.mockClear();
  clearSecurityCache();
});

describe("severityRationale", () => {
  it("explains OSV.dev source", () => {
    const r = severityRationale({
      id: "x",
      source: "osv",
      external_id: "GHSA-1",
      severity: "high",
      affected_field: "deps",
      status: "open",
      title: "",
      description: null,
      storage_object_path: null,
      created_at: "",
      updated_at: "",
    });
    expect(r).toMatch(/OSV\.dev/);
  });
  it("explains generic connector source", () => {
    const r = severityRationale({
      id: "x",
      source: "wiz",
      external_id: "wiz-1",
      severity: "high",
      affected_field: "f",
      status: "open",
      title: "",
      description: null,
      storage_object_path: null,
      created_at: "",
      updated_at: "",
    });
    expect(r).toMatch(/connector_security_scan/);
    expect(r).toMatch(/wiz/);
  });
  it("explains scan_findings rule for non-connector items", () => {
    const r = severityRationale({
      id: "1",
      scan_id: "s1",
      severity: "low",
      affected_field: "fiber_type",
      status: "open",
      title: "",
      description: null,
      created_at: "",
    });
    expect(r).toMatch(/scan grade/);
  });
});

describe("toFindingsCsv", () => {
  it("emits header + escaped rows", () => {
    const csv = toFindingsCsv([
      {
        id: "1",
        source: "wiz",
        external_id: "wiz-1",
        severity: "high",
        affected_field: "f",
        status: "open",
        title: 'has "quotes", and comma',
        description: null,
        storage_object_path: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ]);
    const [header, row] = csv.split("\n");
    expect(header).toBe(
      "id,source,severity,status,affected_field,title,description,created_at"
    );
    expect(row).toContain('"has ""quotes"", and comma"');
    expect(row).toContain("wiz");
  });
});

describe("severityRank", () => {
  it("orders severities low → critical", () => {
    expect(severityRank.low).toBeLessThan(severityRank.medium);
    expect(severityRank.medium).toBeLessThan(severityRank.high);
    expect(severityRank.high).toBeLessThan(severityRank.critical);
  });
});

describe("logAuditEvent", () => {
  it("calls the log_audit_event RPC with all fields", async () => {
    await logAuditEvent({
      action: "read",
      resource_type: "scan",
      resource_id: "abc",
      success: false,
      metadata: { error: "denied" },
    });
    expect(rpc).toHaveBeenCalledWith("log_audit_event", {
      _action: "read",
      _resource_type: "scan",
      _resource_id: "abc",
      _success: false,
      _metadata: { error: "denied" },
    });
  });

  it("never throws when RPC rejects", async () => {
    rpc.mockRejectedValueOnce(new Error("network"));
    await expect(
      logAuditEvent({ action: "x", resource_type: "y" })
    ).resolves.toBeUndefined();
  });
});

describe("getScanFindings", () => {
  it("returns [] for empty/offline ids without touching the network", async () => {
    const a = await getScanFindings("");
    const b = await getScanFindings("offline:abc");
    expect(a.rows).toEqual([]);
    expect(b.rows).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("queries scan_findings and logs a successful audit event", async () => {
    range.mockResolvedValueOnce({
      data: [
        {
          id: "1",
          scan_id: "s1",
          severity: "high",
          affected_field: "fiber_type",
          status: "open",
          title: "t",
          description: null,
          created_at: "2026-01-01",
        },
      ],
      error: null,
      count: 1,
    });
    const out = await getScanFindings("s1");
    expect(out.rows).toHaveLength(1);
    expect(from).toHaveBeenCalledWith("scan_findings");
    expect(eq).toHaveBeenCalledWith("scan_id", "s1");
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "read",
        _resource_type: "scan_findings",
        _resource_id: "s1",
        _success: true,
      })
    );
  });

  it("logs a failure audit event when the query errors", async () => {
    range.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
      count: null,
    });
    const out = await getScanFindings("s2");
    expect(out.rows).toEqual([]);
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "read",
        _resource_type: "scan_findings",
        _resource_id: "s2",
        _success: false,
      })
    );
  });
});

describe("getConnectorFindings", () => {
  it("queries connector_findings ordered by severity and logs a read audit", async () => {
    range.mockResolvedValueOnce({
      data: [
        {
          id: "c1",
          source: "wiz",
          external_id: "wiz-1",
          severity: "high",
          affected_field: "storage.scan-images",
          status: "open",
          title: "t",
          description: null,
          storage_object_path: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      ],
      error: null,
      count: 1,
    });
    const out = await getConnectorFindings();
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].source).toBe("wiz");
    expect(from).toHaveBeenCalledWith("connector_findings");
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "read",
        _resource_type: "connector_findings",
        _success: true,
      })
    );
  });
});

describe("syncConnectorFindings", () => {
  it("invokes the edge function and returns the ingested count", async () => {
    const n = await syncConnectorFindings();
    expect(invoke).toHaveBeenCalledWith("sync-connector-findings", { body: {} });
    expect(n).toBe(3);
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "connector_sync_invoke",
        _resource_type: "connector_findings",
        _success: true,
      })
    );
  });

  it("returns 0 on error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    expect(await syncConnectorFindings()).toBe(0);
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "connector_sync_invoke",
        _success: false,
      })
    );
  });
});

describe("rescanAndReview", () => {
  it("calls the rescan RPC, logs audit, then syncs connectors", async () => {
    const ok = await rescanAndReview("scan-1");
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("rescan_scan_findings", {
      _scan_id: "scan-1",
    });
    expect(rpc).toHaveBeenCalledWith(
      "log_audit_event",
      expect.objectContaining({
        _action: "rescan",
        _resource_type: "scan",
        _resource_id: "scan-1",
        _success: true,
      })
    );
    expect(invoke).toHaveBeenCalledWith("sync-connector-findings", { body: {} });
  });

  it("returns false and skips sync when the RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    const ok = await rescanAndReview("scan-2");
    expect(ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("no-ops for offline scan ids", async () => {
    const ok = await rescanAndReview("offline:abc");
    expect(ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});