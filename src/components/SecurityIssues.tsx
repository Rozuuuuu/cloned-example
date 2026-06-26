import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getScanFindings,
  getConnectorFindings,
  rescanAndReview,
  fullRescan,
  severityRationale,
  toFindingsCsv,
  toFindingsPdf,
  clearSecurityCache,
  severityClasses,
  severityRank,
  statusClasses,
  type ConnectorFinding,
  type ScanFinding,
} from "@/lib/security";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface Props {
  scanId?: string | null;
}

const PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 50;

/** Security issues panel for a scan, plus workspace-wide connector findings. */
const SecurityIssues = ({ scanId }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [connector, setConnector] = useState<ConnectorFinding[] | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [fullScanning, setFullScanning] = useState(false);
  const [tick, setTick] = useState(0);
  const sourceFilter = searchParams.get("src") ?? "all";
  const sevFilter = searchParams.get("sev") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize =
    Number(searchParams.get("ps") ?? String(PAGE_SIZE)) || PAGE_SIZE;
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };
  const setSourceFilter = (v: string) =>
    updateParams({ src: v === "all" ? null : v, page: null });
  const setSevFilter = (v: string) =>
    updateParams({ sev: v === "all" ? null : v, page: null });
  const setPage = (updater: number | ((p: number) => number)) => {
    const next = typeof updater === "function" ? updater(page) : updater;
    updateParams({ page: next <= 1 ? null : String(next) });
  };
  const setPageSize = (n: number) =>
    updateParams({ ps: n === PAGE_SIZE ? null : String(n), page: null });
  const [connectorTotal, setConnectorTotal] = useState(0);
  const [exporting, setExporting] = useState<false | "csv" | "pdf">(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastPdfError, setLastPdfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getConnectorFindings({
        page,
        pageSize,
        sourceFilter,
        severityFilter: sevFilter,
      });
      if (cancelled) return;
      const sorted = [...res.rows].sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity]
      );
      setConnector(sorted);
      setConnectorTotal(res.total);
    })();
    if (!scanId) {
      setFindings([]);
      return;
    }
    (async () => {
      const res = await getScanFindings(scanId, {
        page: 1,
        pageSize: FETCH_PAGE_SIZE,
      });
      if (cancelled) return;
      const sorted = [...res.rows].sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity]
      );
      setFindings(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId, tick, sourceFilter, sevFilter, page, pageSize]);

  // Distinct sources for the filter chips (always include "all").
  const sources = useMemo(() => {
    const set = new Set<string>();
    (connector ?? []).forEach((f) => set.add(f.source));
    return ["all", ...Array.from(set).sort()];
  }, [connector]);

  // Filter + sort by severity desc, then created_at desc (stable from query).
  const filtered = useMemo(() => {
    const list = connector ?? [];
    const f = list.filter(
      (x) =>
        (sourceFilter === "all" || x.source === sourceFilter) &&
        (sevFilter === "all" || x.severity === sevFilter)
    );
    return [...f].sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
  }, [connector, sourceFilter, sevFilter]);

  const totalPages = Math.max(1, Math.ceil(connectorTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered;
  const isEmpty = connectorTotal === 0 && (connector?.length ?? 0) === 0;

  if (!scanId) return null;

  const onRescan = async () => {
    if (!scanId || rescanning) return;
    setRescanning(true);
    setProgress("Re-scanning…");
    setFindings(null);
    setConnector(null);
    clearSecurityCache();
    const ok = await rescanAndReview(scanId);
    if (ok) {
      toast.success("Re-scan complete");
    } else {
      toast.error("Re-scan failed");
    }
    setTick((t) => t + 1);
    setRescanning(false);
    setProgress(null);
  };

  const onFullRescan = async () => {
    if (fullScanning || rescanning) return;
    setFullScanning(true);
    setProgress("Re-running all scans…");
    setFindings(null);
    setConnector(null);
    clearSecurityCache();
    let res: Awaited<ReturnType<typeof fullRescan>> = { ok: false, scans: 0, ingested: 0 };
    try {
      setProgress("Syncing connector findings…");
      res = await fullRescan();
    } catch (e) {
      toast.error("Full re-scan failed");
      setFullScanning(false);
      setProgress(null);
      setTick((t) => t + 1);
      return;
    }
    if (res.ok) {
      toast.success(
        `Full re-scan complete — ${res.scans} scan(s), ${res.ingested} connector findings`
      );
    } else {
      toast.error("Full re-scan failed");
    }
    setTick((t) => t + 1);
    setFullScanning(false);
    setProgress(null);
  };

  /** Fetch every page of connector findings matching the active filters/sort. */
  const fetchAllFilteredConnector = async (): Promise<ConnectorFinding[]> => {
    const acc: ConnectorFinding[] = [];
    let p = 1;
    // Hard cap to avoid runaway exports.
    while (p <= 50) {
      const res = await getConnectorFindings({
        page: p,
        pageSize: FETCH_PAGE_SIZE,
        sourceFilter,
        severityFilter: sevFilter,
      });
      acc.push(...res.rows);
      if (acc.length >= res.total || res.rows.length === 0) break;
      p += 1;
    }
    return [...acc].sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
  };

  const onExportCsv = async () => {
    if (exporting) return;
    setExporting("csv");
    try {
      const conn = await fetchAllFilteredConnector();
      const scanRows = (sourceFilter === "all" ? findings ?? [] : []).filter(
        (f) => sevFilter === "all" || f.severity === sevFilter
      );
      const rows = [...scanRows, ...conn];
      const csv = toFindingsCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-issues-${sourceFilter}-${sevFilter}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} issue(s) to CSV`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("CSV export failed", { description: msg });
    } finally {
      setExporting(false);
    }
  };

  const runPdfExport = async (attempt: number): Promise<void> => {
    const conn = await fetchAllFilteredConnector();
    const scanRows = (sourceFilter === "all" ? findings ?? [] : []).filter(
      (f) => sevFilter === "all" || f.severity === sevFilter
    );
    const rows = [...scanRows, ...conn].sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
    toFindingsPdf(rows, {
      sourceFilter,
      severityFilter: sevFilter,
    });
    toast.success(
      `Exported ${rows.length} issue(s) to PDF${attempt > 0 ? ` (retry ${attempt})` : ""}`
    );
    setLastPdfError(null);
  };

  const onExportPdf = async (attempt = 0) => {
    if (exporting) return;
    setExporting("pdf");
    try {
      await runPdfExport(attempt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastPdfError(msg);
      toast.error(
        attempt > 0
          ? `PDF export failed (after ${attempt + 1} attempts)`
          : "PDF export failed",
        {
          description: `Last error: ${msg}`,
          action: {
            label: "Retry",
            onClick: () => {
              void onExportPdf(attempt + 1);
            },
          },
        }
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <section
      aria-label="Security issues"
      className="mt-4 rounded-2xl bg-white p-4 text-foreground"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Security Issues
        </h2>
        <div className="flex items-center gap-2">
          {findings && (
            <span className="text-xs text-muted-foreground">
              {findings.length} {findings.length === 1 ? "issue" : "issues"}
            </span>
          )}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!!exporting}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => onExportPdf(0)}
            disabled={!!exporting}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={onFullRescan}
            disabled={fullScanning || rescanning}
            aria-busy={fullScanning}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {fullScanning ? "Full re-scanning…" : "Full re-scan"}
          </button>
          <button
            type="button"
            onClick={onRescan}
            disabled={rescanning || fullScanning}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {rescanning ? "Re-scanning…" : "Re-scan and review"}
          </button>
        </div>
      </div>

      {(fullScanning || rescanning) && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/60" />
          {progress ?? "Working…"}
        </div>
      )}

      {findings === null && (
        <div className="mt-3 space-y-2" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {findings && findings.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          No security issues detected for this scan.
        </p>
      )}

      {findings && findings.length > 0 && (
        <ul className="mt-3 space-y-2">
          {findings.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityClasses[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClasses[f.status]}`}
                >
                  {f.status}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  field: <code className="font-mono">{f.affected_field}</code>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="How was this severity determined?"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {severityRationale(f)}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1.5 text-sm font-semibold">{f.title}</div>
              {f.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace issues
        </h3>
        {connector && (
          <span className="text-[11px] text-muted-foreground">
            {connector.length} from connectors
          </span>
        )}
      </div>

      {connector === null && (
        <div className="mt-2 space-y-2" aria-busy="true">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {connector && connector.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"
          data-testid="security-empty-state"
        >
          <p className="text-sm font-medium text-foreground">No issues found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sourceFilter === "all" && sevFilter === "all"
              ? "No connector findings (Wiz, etc.) reported."
              : `No findings match the current filters (source=${sourceFilter}, severity=${sevFilter}).`}
          </p>
          {(sourceFilter !== "all" || sevFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSourceFilter("all");
                setSevFilter("all");
              }}
              className="mt-2 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted"
            >
              Clear filters
            </button>
          )}
          <div className="mt-3 flex items-center justify-center">
            <Pagination className="m-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled
                    onClick={(e) => e.preventDefault()}
                    className="pointer-events-none opacity-50"
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled
                    onClick={(e) => e.preventDefault()}
                    className="pointer-events-none opacity-50"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}

      {connector && connector.length > 0 && (
        <>
          {sources.length > 2 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by source">
              {sources.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSourceFilter(s)}
                  role="tab"
                  aria-selected={sourceFilter === s}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    sourceFilter === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by severity">
            {["all", "critical", "high", "medium", "low"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSevFilter(s)}
                role="tab"
                aria-selected={sevFilter === s}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                  sevFilter === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <ul className="mt-2 space-y-2">
          {pageSlice.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityClasses[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClasses[f.status]}`}
                >
                  {f.status}
                </span>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.source}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  field: <code className="font-mono">{f.affected_field}</code>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="How was this severity determined?"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {severityRationale(f)}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1.5 text-sm font-semibold">{f.title}</div>
              {f.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              )}
            </li>
          ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <label htmlFor="page-size">Page size</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                Page {safePage} of {totalPages} · {connectorTotal} total
              </span>
            </div>
            {totalPages > 1 && (
            <Pagination className="m-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
                  const n = i + 1;
                  return (
                    <PaginationItem key={n}>
                      <PaginationLink
                        href="#"
                        isActive={n === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(n);
                        }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                {totalPages > 5 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    aria-disabled={safePage === totalPages}
                    className={
                      safePage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            )}
          </div>
        </>
      )}
    </section>
    </TooltipProvider>
  );
};

export default SecurityIssues;