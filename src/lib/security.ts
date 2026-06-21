import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export interface FetchOptions {
  page?: number;
  pageSize?: number;
  /** Bypass in-memory cache. */
  noCache?: boolean;
  sourceFilter?: string;
  severityFilter?: string;
  sort?: string;
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

// Simple in-memory cache keyed by query signature. TTL ~ 30s.
const CACHE_TTL_MS = 30_000;
const _cache = new Map<string, { at: number; value: unknown }>();
const cacheGet = <T,>(key: string): T | null => {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return hit.value as T;
};
const cacheSet = (key: string, value: unknown) =>
  _cache.set(key, { at: Date.now(), value });
export const clearSecurityCache = () => _cache.clear();

/** Fetch security findings for a scan. Logs read + any denial. */
export const getScanFindings = async (
  scanId: string,
  opts: FetchOptions = {}
): Promise<Paginated<ScanFinding>> => {
  const empty: Paginated<ScanFinding> = {
    rows: [],
    page: 1,
    pageSize: opts.pageSize ?? 50,
    total: 0,
  };
  if (!scanId || scanId.startsWith("offline:")) return empty;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, opts.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = opts.sort ?? "severity_desc,created_at_desc";
  const cacheKey = `sf:${scanId}:${page}:${pageSize}:${sort}`;
  if (!opts.noCache) {
    const cached = cacheGet<Paginated<ScanFinding>>(cacheKey);
    if (cached) return cached;
  }
  const { data: auth } = await supabase.auth.getUser();
  const isAnon = !!(auth?.user?.app_metadata as { is_anonymous?: boolean } | undefined)?.is_anonymous;
  const { data, error, count } = await supabase
    .from("scan_findings")
    .select("*", { count: "exact" })
    .eq("scan_id", scanId)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    await logAuditEvent({
      action: "read",
      resource_type: "scan_findings",
      resource_id: scanId,
      success: false,
      metadata: {
        error: error.message,
        code: error.code,
        anonymous: isAnon,
        filters: { scan_id: scanId },
        sort,
        page,
        pageSize,
      },
    });
    return empty;
  }
  const rows = (data ?? []) as ScanFinding[];
  await logAuditEvent({
    action: "read",
    resource_type: "scan_findings",
    resource_id: scanId,
    success: true,
    metadata: {
      count: rows.length,
      total: count ?? rows.length,
      anonymous: isAnon,
      filters: { scan_id: scanId },
      sort,
      page,
      pageSize,
      ids: rows.map((r) => r.id),
    },
  });
  const result: Paginated<ScanFinding> = {
    rows,
    page,
    pageSize,
    total: count ?? rows.length,
  };
  cacheSet(cacheKey, result);
  return result;
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

export interface ConnectorFinding {
  id: string;
  source: string;
  external_id: string;
  severity: FindingSeverity;
  affected_field: string;
  status: FindingStatus;
  title: string;
  description: string | null;
  storage_object_path: string | null;
  created_at: string;
  updated_at: string;
}

/** Fetch workspace-wide connector findings (Wiz, etc.). */
export const getConnectorFindings = async (
  opts: FetchOptions = {}
): Promise<Paginated<ConnectorFinding>> => {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, opts.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sourceFilter = opts.sourceFilter ?? "all";
  const severityFilter = opts.severityFilter ?? "all";
  const sort = opts.sort ?? "severity_desc,created_at_desc";
  const cacheKey = `cf:${page}:${pageSize}:${sourceFilter}:${severityFilter}:${sort}`;
  if (!opts.noCache) {
    const cached = cacheGet<Paginated<ConnectorFinding>>(cacheKey);
    if (cached) return cached;
  }
  const { data: auth } = await supabase.auth.getUser();
  const isAnon = !!(auth?.user?.app_metadata as { is_anonymous?: boolean } | undefined)?.is_anonymous;
  let q = supabase
    .from("connector_findings")
    .select("*", { count: "exact" })
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
  if (severityFilter !== "all") q = q.eq("severity", severityFilter);
  const { data, error, count } = await q;
  if (error) {
    await logAuditEvent({
      action: "read",
      resource_type: "connector_findings",
      success: false,
      metadata: {
        error: error.message,
        code: error.code,
        anonymous: isAnon,
        filters: { source: sourceFilter, severity: severityFilter },
        sort,
        page,
        pageSize,
      },
    });
    return { rows: [], page, pageSize, total: 0 };
  }
  const rows = (data ?? []) as ConnectorFinding[];
  await logAuditEvent({
    action: "read",
    resource_type: "connector_findings",
    success: true,
    metadata: {
      count: rows.length,
      total: count ?? rows.length,
      anonymous: isAnon,
      filters: { source: sourceFilter, severity: severityFilter },
      sort,
      page,
      pageSize,
      ids: rows.map((r) => r.id),
    },
  });
  const result: Paginated<ConnectorFinding> = {
    rows,
    page,
    pageSize,
    total: count ?? rows.length,
  };
  cacheSet(cacheKey, result);
  return result;
};

/** Trigger the sync-connector-findings edge function. Returns ingested count. */
export const syncConnectorFindings = async (): Promise<number> => {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    ingested: number;
  }>("sync-connector-findings", { body: {} });
  const ok = !error && !!data?.ok;
  await logAuditEvent({
    action: "connector_sync_invoke",
    resource_type: "connector_findings",
    success: ok,
    metadata: ok
      ? { ingested: data?.ingested ?? 0 }
      : { error: error?.message ?? "invoke_failed" },
  });
  if (!ok) return 0;
  return data?.ingested ?? 0;
};

/** Re-run a scan's auto-findings + connector ingestion. Owner-only via RPC. */
export const rescanAndReview = async (scanId: string): Promise<boolean> => {
  if (!scanId || scanId.startsWith("offline:")) return false;
  const { error } = await supabase.rpc("rescan_scan_findings", {
    _scan_id: scanId,
  });
  await logAuditEvent({
    action: "rescan",
    resource_type: "scan",
    resource_id: scanId,
    success: !error,
    metadata: error ? { error: error.message } : null,
  });
  if (error) return false;
  await syncConnectorFindings();
  return true;
};

/**
 * Re-run findings for every scan the signed-in user owns AND refresh
 * connector findings (Wiz / OSV). Returns counts for UI feedback.
 */
export const fullRescan = async (): Promise<{
  ok: boolean;
  scans: number;
  ingested: number;
}> => {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) {
    await logAuditEvent({
      action: "full_rescan",
      resource_type: "scan",
      success: false,
      metadata: { error: "no_session" },
    });
    return { ok: false, scans: 0, ingested: 0 };
  }
  const { data: scans, error } = await supabase
    .from("scans")
    .select("id")
    .eq("user_id", uid);
  if (error) {
    await logAuditEvent({
      action: "full_rescan",
      resource_type: "scan",
      success: false,
      metadata: { error: error.message },
    });
    return { ok: false, scans: 0, ingested: 0 };
  }
  const ids = (scans ?? []).map((s) => s.id as string);
  let okAll = true;
  for (const id of ids) {
    const { error: rErr } = await supabase.rpc("rescan_scan_findings", {
      _scan_id: id,
    });
    if (rErr) okAll = false;
  }
  const ingested = await syncConnectorFindings();
  await logAuditEvent({
    action: "full_rescan",
    resource_type: "scan",
    success: okAll,
    metadata: { scans: ids.length, ingested },
  });
  return { ok: okAll, scans: ids.length, ingested };
};

/**
 * Plain-English explanation of how a finding's severity was determined.
 * Surfaced in the SecurityIssues tooltip so users can audit ranking logic.
 */
export const severityRationale = (
  f: ScanFinding | ConnectorFinding
): string => {
  const isConnector = (x: ScanFinding | ConnectorFinding): x is ConnectorFinding =>
    "source" in x;
  if (isConnector(f)) {
    if (f.source === "osv" || f.source === "osv.dev") {
      return `Severity from OSV.dev advisory (source=${f.source}). Derived from CVSS / ecosystem rating on field "${f.affected_field}".`;
    }
    return `Severity from connector_security_scan (source=${f.source}, external_id=${f.external_id}). Field "${f.affected_field}".`;
  }
  return `Severity auto-derived from scan grade and presence of field "${f.affected_field}".`;
};

/** Build a CSV string for the given findings list. */
export const toFindingsCsv = (
  rows: Array<ScanFinding | ConnectorFinding>
): string => {
  const header = [
    "id",
    "source",
    "severity",
    "status",
    "affected_field",
    "title",
    "description",
    "created_at",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      esc(r.id),
      esc("source" in r ? r.source : "scan"),
      esc(r.severity),
      esc(r.status),
      esc(r.affected_field),
      esc(r.title),
      esc(r.description ?? ""),
      esc(r.created_at),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
};

/** Build and download a PDF for the given findings list. */
export const toFindingsPdf = (
  rows: Array<ScanFinding | ConnectorFinding>,
  opts: { sourceFilter?: string; severityFilter?: string; filename?: string } = {}
): void => {
  const doc = new jsPDF({ orientation: "landscape" });
  const title = "Security Issues";
  const subtitle = `source=${opts.sourceFilter ?? "all"} · severity=${
    opts.severityFilter ?? "all"
  } · ${rows.length} item(s)`;
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 20);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 26,
    head: [["Source", "Severity", "Status", "Field", "Title", "Created"]],
    body: rows.map((r) => [
      "source" in r ? r.source : "scan",
      r.severity,
      r.status,
      r.affected_field,
      r.title,
      new Date(r.created_at).toISOString().slice(0, 10),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  doc.save(
    opts.filename ??
      `security-issues-${opts.sourceFilter ?? "all"}-${
        opts.severityFilter ?? "all"
      }.pdf`
  );
};