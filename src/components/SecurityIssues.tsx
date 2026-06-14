import { useEffect, useState } from "react";
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

interface Props {
  scanId?: string | null;
}

/** Security issues panel for a scan, plus workspace-wide connector findings. */
const SecurityIssues = ({ scanId }: Props) => {
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [connector, setConnector] = useState<ConnectorFinding[] | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [tick, setTick] = useState(0);

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
        <ul className="mt-2 space-y-2">
          {connector.map((f) => (
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
      )}
    </section>
  );
};

export default SecurityIssues;