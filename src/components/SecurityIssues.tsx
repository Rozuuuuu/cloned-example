import { useEffect, useMemo, useState } from "react";
import {
  getScanFindings,
  getConnectorFindings,
  rescanAndReview,
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

interface Props {
  scanId?: string | null;
}

const PAGE_SIZE = 10;

/** Security issues panel for a scan, plus workspace-wide connector findings. */
const SecurityIssues = ({ scanId }: Props) => {
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [connector, setConnector] = useState<ConnectorFinding[] | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [tick, setTick] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getConnectorFindings();
      if (cancelled) return;
      const sorted = [...data].sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity]
      );
      setConnector(sorted);
    })();
    if (!scanId) {
      setFindings([]);
      return;
    }
    (async () => {
      const data = await getScanFindings(scanId);
      if (cancelled) return;
      const sorted = [...data].sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity]
      );
      setFindings(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId, tick]);

  // Distinct sources for the filter chips (always include "all").
  const sources = useMemo(() => {
    const set = new Set<string>();
    (connector ?? []).forEach((f) => set.add(f.source));
    return ["all", ...Array.from(set).sort()];
  }, [connector]);

  // Filter + sort by severity desc, then created_at desc (stable from query).
  const filtered = useMemo(() => {
    const list = connector ?? [];
    const f = sourceFilter === "all"
      ? list
      : list.filter((x) => x.source === sourceFilter);
    return [...f].sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
  }, [connector, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Reset page when filter changes or data reloads.
  useEffect(() => {
    setPage(1);
  }, [sourceFilter, connector]);

  if (!scanId) return null;

  const onRescan = async () => {
    if (!scanId || rescanning) return;
    setRescanning(true);
    setFindings(null);
    setConnector(null);
    const ok = await rescanAndReview(scanId);
    if (ok) {
      toast.success("Re-scan complete");
    } else {
      toast.error("Re-scan failed");
    }
    setTick((t) => t + 1);
    setRescanning(false);
  };

  return (
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
            onClick={onRescan}
            disabled={rescanning}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {rescanning ? "Re-scanning…" : "Re-scan and review"}
          </button>
        </div>
      </div>

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
        <p className="mt-1 text-xs text-muted-foreground">
          No connector findings (Wiz, etc.) reported.
        </p>
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
          {totalPages > 1 && (
            <Pagination className="mt-3">
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
        </>
      )}
    </section>
  );
};

export default SecurityIssues;