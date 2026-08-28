import type { ReactNode } from "react";

/**
 * Empty state drawn as an unmounted specimen plate: a hatched card slot with a
 * catalogue number, a stamped caption and a single call to action.
 */
export const SpecimenEmpty = ({
  index = "—",
  title,
  note,
  action,
}: {
  index?: string;
  title: string;
  note: string;
  action?: ReactNode;
}) => (
  <div
    data-testid="specimen-empty"
    className="border-2 border-deep-sage bg-card p-6 sm:p-8"
    style={{ boxShadow: "var(--shadow-card)" }}
  >
    <div className="flex items-center justify-between border-b-2 border-deep-sage pb-2">
      <span className="type-mono text-sage-green">SPECIMEN {index}</span>
      <span className="type-label text-sage-green">Not yet catalogued</span>
    </div>

    <div
      aria-hidden
      className="mt-5 flex h-32 items-center justify-center border-2 border-dashed border-deep-sage/50"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, hsl(var(--deep-sage) / 0.08) 0 2px, transparent 2px 10px)",
      }}
    >
      <span className="type-h2 text-deep-sage/40">Empty plate</span>
    </div>

    <h3 className="type-h2 mt-5 text-deep-sage">{title}</h3>
    <p className="type-body mt-1 max-w-prose text-muted-foreground">{note}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/** A single skeleton bar that inherits the paper shimmer. */
const Bar = ({ className = "" }: { className?: string }) => (
  <div className={`habi-shimmer bg-muted ${className}`} />
);

/**
 * Loading state as a partially-printed specimen sheet: ruled rows, a plate
 * number gutter and shimmering ink bars. Deliberately not rounded pills.
 */
export const SpecimenSkeletonList = ({
  rows = 3,
  label = "Developing plate",
}: {
  rows?: number;
  label?: string;
}) => (
  <div
    data-testid="specimen-skeleton"
    aria-busy="true"
    aria-live="polite"
    className="border-2 border-deep-sage bg-card"
  >
    <div className="flex items-center justify-between border-b-2 border-deep-sage px-4 py-2">
      <span className="type-mono text-sage-green">{label}</span>
      <span className="type-mono text-sage-green">···</span>
    </div>
    <div className="divide-y-2 divide-deep-sage/15">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <span className="type-mono w-6 shrink-0 text-sage-green/70">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Bar className="h-12 w-12 shrink-0 border-2 border-deep-sage/20" />
          <div className="flex-1 space-y-2">
            <Bar className="h-4 w-2/3" />
            <Bar className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
    <span className="sr-only">Loading specimens…</span>
  </div>
);

/** Inline skeleton block for masthead/metric areas on the inked header. */
export const SpecimenSkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`habi-shimmer bg-white/20 ${className}`} />
);

export default SpecimenEmpty;
