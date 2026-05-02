import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/scanner", label: "Scan", icon: "📷" },
  { to: "/history", label: "History", icon: "🧺" },
];

/** Persistent bottom navigation shown on the main app screens. */
export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-border bg-cream/95 px-3 py-2 backdrop-blur"
    >
      {tabs.map((t) => {
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <button
            key={t.to}
            onClick={() => navigate(t.to)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              active ? "text-deep-sage" : "text-muted-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;