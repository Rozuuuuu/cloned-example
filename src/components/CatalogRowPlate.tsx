import type { ReactNode } from "react";
import { isGoodGrade, metricsFor } from "@/lib/catalog";
import type { ScanRecord } from "@/lib/habi";

export type CatalogRowPlateProps = {
  scan: ScanRecord;
  /** Resolved photo URL for this specimen, if any. */
  image?: string;
  /** Printed index label, e.g. "01". */
  index?: string;
  /** Buttons rendered in the footer strip of the plate. */
  actions?: ReactNode;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

/**
 * One catalog row in the Result-page plate layout: photo, grade, metrics.
 * Shared by the Catalog list and the Result page's catalog view so both match.
 */
export const CatalogRowPlate = ({ scan, image, index, actions }: CatalogRowPlateProps) => {
  const m = metricsFor(scan.grade);
  const gradeColor = isGoodGrade(scan.grade)
    ? "hsl(var(--sage-green))"
    : "hsl(var(--warning-red))";

  return (
    <article
      data-testid="catalog-row"
      className="grid gap-0 border-2 border-deep-sage md:grid-cols-12"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-stretch border-b-2 border-deep-sage md:col-span-5 md:border-b-0 md:border-r-2">
        {image && (
          <img
            src={image}
            alt={scan.fabricName}
            loading="lazy"
            className="h-40 w-1/2 border-r-2 border-deep-sage object-cover md:h-full"
          />
        )}
        <div className="flex flex-1 flex-col items-center justify-center bg-card p-6">
          <span className="font-display text-[48px] leading-none" style={{ color: gradeColor }}>
            {scan.grade}
          </span>
          <span className="type-label text-sage-green">Grade</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:col-span-7">
        <div className="col-span-2 border-b-2 border-deep-sage bg-card p-4">
          <div className="type-mono text-sage-green">{index ?? "—"} · Specimen</div>
          <div className="type-h2 text-deep-sage">{scan.fabricName}</div>
          <div className="type-label text-sage-green">
            {scan.fiberType} · {formatDate(scan.scannedAt)}
          </div>
        </div>
        <div className="border-r-2 border-deep-sage bg-card p-4">
          <div className="type-mono text-sage-green">Breathability</div>
          <div className="type-h1 text-deep-sage">{m.breathability}%</div>
        </div>
        <div className="bg-card p-4">
          <div className="type-mono text-sage-green">Sustainability</div>
          <div className="type-h1 text-deep-sage">{m.sustainability}%</div>
        </div>
        {actions && (
          <div className="col-span-2 flex flex-wrap gap-0 border-t-2 border-deep-sage bg-card p-4">
            {actions}
          </div>
        )}
      </div>
    </article>
  );
};

export default CatalogRowPlate;
