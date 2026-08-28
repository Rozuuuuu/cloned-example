import { useTheme } from "@/hooks/use-theme";

/**
 * Specimen-grid theme switch: two hard-ruled cells, the active one inked in.
 * Never rounded, always 2px rules — matches every other control in the system.
 */
export const ThemeToggle = ({ inverted = false }: { inverted?: boolean }) => {
  const { theme, setTheme } = useTheme();
  const frame = inverted ? "border-cream/50" : "border-deep-sage";
  const cell = (active: boolean) =>
    active
      ? inverted
        ? "bg-cream text-deep-sage"
        : "bg-deep-sage text-cream"
      : inverted
        ? "text-cream hover:bg-cream/20"
        : "text-deep-sage hover:bg-terracotta/30";

  return (
    <div
      role="group"
      aria-label="Color theme"
      data-testid="theme-toggle"
      className={`inline-flex items-stretch border-2 ${frame}`}
    >
      {(["light", "dark"] as const).map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          aria-label={t === "light" ? "Light theme" : "Dark theme"}
          className={`type-mono px-2.5 py-1.5 transition-colors ${i === 0 ? `border-r-2 ${frame}` : ""} ${cell(theme === t)}`}
        >
          {t === "light" ? "☀ Day" : "☾ Night"}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
