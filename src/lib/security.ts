import { supabase } from "@/integrations/supabase/client";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "acknowledged" | "resolved";

export interface ScanFinding {
  id: string;
  scan_id: string;
  severity: FindingSeverity;
  affected_field: string;
  status: FindingStatus;
  title: string;
  description: string | null;
  created_at: string;
}

/** Fetch security findings for a scan. Logs read + any denial. */
export const getScanFindings = async (
  scanId: string
): Promise<ScanFinding[]> => {
  if (!scanId || scanId.startsWith("offline:")) return [];
  const { data, error } = await supabase
    .from("scan_findings")
    .select("*")
    .eq("scan_id", scanId)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    await logAuditEvent({
      action: "read",
      resource_type: "scan_findings",
      resource_id: scanId,
      success: false,
      metadata: { error: error.message, code: error.code },
    });
    return [];
  }
  await logAuditEvent({
    action: "read",
    resource_type: "scan_findings",
    resource_id: scanId,
    success: true,
    metadata: { count: data?.length ?? 0 },
  });
  return (data ?? []) as ScanFinding[];
};

export interface AuditEvent {
  action: string;
  resource_type: string;
  resource_id?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown> | null;
}

/** Fire-and-forget audit logger. Never throws. */
export const logAuditEvent = async (event: AuditEvent): Promise<void> => {
  try {
    await supabase.rpc("log_audit_event", {
      _action: event.action,
      _resource_type: event.resource_type,
      _resource_id: event.resource_id ?? null,
      _success: event.success ?? true,
      _metadata: (event.metadata ?? null) as never,
    });
  } catch {
    /* best-effort */
  }
};

export const severityRank: Record<FindingSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const severityClasses: Record<FindingSeverity, string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

export const statusClasses: Record<FindingStatus, string> = {
  open: "bg-red-50 text-red-700 border-red-100",
  acknowledged: "bg-amber-50 text-amber-700 border-amber-100",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
};