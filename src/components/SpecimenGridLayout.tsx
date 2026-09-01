import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";

export type SpecimenGridLayoutProps = {
  /** Masthead headline, e.g. "Scan History". */
  title: ReactNode;
  /** Small-caps index line printed under the masthead rule. */
  eyebrow?: ReactNode;
  /** Right-hand masthead slot (exports, sign-out, etc.). */
  actions?: ReactNode;
  /** Extra plate rendered inside the masthead block (weather, shortcuts…). */
  mastheadExtra?: ReactNode;
  children: ReactNode;
  /** Render the persistent bottom navigation. Default: true. */
  withNav?: boolean;
  /** Extra classes for the content container. */
  contentClassName?: string;
};

/**
 * Single shell for every screen: identical masthead, 2px ink rules, gutters and
 * max width. Pages supply only content, so spacing/shadows never drift.
 */
export const SpecimenGridLayout = ({
  title,
  eyebrow,
  actions,
  mastheadExtra,
  children,
  withNav = true,
  contentClassName = "",
}: SpecimenGridLayoutProps) => {
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <div className="min-h-dvh bg-cream" data-specimen-shell>
      <a href="#specimen-main" className="habi-skip-link">
        Skip to content
      </a>
      <header
        data-testid="specimen-masthead"
        className="border-b-2 border-deep-sage bg-deep-sage px-4 pb-6 pt-8 text-cream sm:px-6 md:px-8 md:pb-8 lg:px-10"
      >
        <div className="mx-auto mb-5 flex w-full max-w-6xl items-center justify-between gap-4 border-b-2 border-cream/30 pb-3">
          <span className="type-h3">Habi-Check</span>
          <div className="flex items-center gap-3">
            <span className="type-label hidden text-terracotta sm:inline">
              Specimen Index · {today}
            </span>
            <ThemeToggle inverted />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 id="specimen-title" className="type-h1 min-w-0 break-words">
              {title}
            </h1>
            {eyebrow && <p className="type-label mt-1 text-terracotta">{eyebrow}</p>}
          </div>
          {actions && (
            <div role="group" aria-label="Page actions" className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {mastheadExtra && (
          <div className="mx-auto mt-4 w-full max-w-6xl border-2 border-cream/40 p-4 sm:p-5 md:mt-6 md:p-6">
            {mastheadExtra}
          </div>
        )}
      </header>

      <main
        id="specimen-main"
        tabIndex={-1}
        aria-labelledby="specimen-title"
        className={`mx-auto w-full max-w-6xl px-4 pb-40 pt-5 sm:px-6 md:px-8 md:pb-32 lg:px-10 ${contentClassName}`}
      >
        {children}
      </main>

      {withNav && <BottomNav />}
    </div>
  );

};

export default SpecimenGridLayout;
