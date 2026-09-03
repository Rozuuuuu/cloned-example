import { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Index", icon: "01", description: "Dashboard index" },
  { to: "/scanner", label: "Scan", icon: "02", description: "Scan a garment" },
  { to: "/catalog", label: "Catalog", icon: "03", description: "Specimen catalog" },
  { to: "/history", label: "Closet", icon: "04", description: "Scan history closet" },
];

/** Persistent bottom navigation shown on the main app screens. */
export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Roving arrow-key navigation across the three plates (Home/End included). */
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl items-stretch border-t-2 border-deep-sage bg-cream"
    >
      {tabs.map((t, i) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <button
            key={t.to}
            ref={(el) => (refs.current[i] = el)}
            onClick={() => navigate(t.to)}
            onKeyDown={(e) => onKeyDown(e, i)}
            type="button"
            aria-label={t.description}
            aria-current={active ? "page" : undefined}
            data-testid={`nav-${t.label.toLowerCase()}`}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 border-r-2 border-deep-sage px-2 py-3 transition-colors last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-terracotta ${
              active ? "bg-deep-sage text-cream" : "bg-cream text-deep-sage hover:bg-terracotta/30"
            }`}
          >
            <span aria-hidden className="type-mono opacity-70">
              {t.icon}
            </span>
            <span className="type-h3">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
