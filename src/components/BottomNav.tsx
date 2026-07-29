import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Index", icon: "01" },
  { to: "/scanner", label: "Scan", icon: "02" },
  { to: "/history", label: "Closet", icon: "03" },
];

/** Persistent bottom navigation shown on the main app screens. */
export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl items-stretch border-t-2 border-deep-sage bg-cream"
    >
      {tabs.map((t) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <button
            key={t.to}
            onClick={() => navigate(t.to)}
            className={`flex flex-1 flex-col items-center gap-0.5 border-r-2 border-deep-sage px-2 py-3 transition-colors last:border-r-0 ${
              active ? "bg-deep-sage text-cream" : "bg-cream text-deep-sage hover:bg-terracotta/30"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="font-mono text-[9px] tracking-[0.2em] opacity-70">{t.icon}</span>
            <span className="font-display text-lg uppercase leading-none">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;