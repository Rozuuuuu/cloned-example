import { useEffect, useState } from "react";
import {
  getScanFindings,
  severityClasses,
  severityRank,
  statusClasses,
  type ScanFinding,
} from "@/lib/security";

interface Props {
  scanId?: string | null;
}

/** Security issues panel for a scan: severity, affected fields, statuses. */
const SecurityIssues = ({ scanId }: Props) => {
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);

  useEffect(() => {
    let cancelled = false;
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
  }, [scanId]);

  if (!scanId) return null;

  return (
    <section
      aria-label="Security issues"
      className="mt-4 rounded-2xl bg-white p-4 text-foreground"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Security Issues
        </h2>
        {findings && (
          <span className="text-xs text-muted-foreground">
            {findings.length} {findings.length === 1 ? "issue" : "issues"}
          </span>
        )}
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
    </section>
  );
};

export default SecurityIssues;