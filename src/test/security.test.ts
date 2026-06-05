import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock state so vi.mock factory can reach it.
const { rpc, from, select, eq, order1, order2 } = vi.hoisted(() => {
  const order2 = vi.fn().mockResolvedValue({ data: [], error: null });
  const order1 = vi.fn(() => ({ order: order2 }));
  const eq = vi.fn(() => ({ order: order1 }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { rpc, from, select, eq, order1, order2 };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from },
}));

import {
  getScanFindings,
  logAuditEvent,
  severityRank,
} from "@/lib/security";

beforeEach(() => {
  rpc.mockClear();
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  order1.mockClear();
  order2.mockClear();
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
    expect(await getScanFindings("")).toEqual([]);
    expect(await getScanFindings("offline:abc")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("queries scan_findings and logs a successful audit event", async () => {
    order2.mockResolvedValueOnce({
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
    });
    const out = await getScanFindings("s1");
    expect(out).toHaveLength(1);
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
    order2.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const out = await getScanFindings("s2");
    expect(out).toEqual([]);
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