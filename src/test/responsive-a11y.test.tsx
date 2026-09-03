import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SpecimenGridLayout from "@/components/SpecimenGridLayout";
import BottomNav from "@/components/BottomNav";
import { ThemeProvider } from "@/hooks/use-theme";
import ThemeToggle from "@/components/ThemeToggle";

/** Drive jsdom to a given viewport so responsive contracts can be asserted. */
const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
  window.matchMedia = ((query: string) => {
    const m = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = m ? width <= Number(m[1]) : min ? width >= Number(min[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  window.dispatchEvent(new Event("resize"));
};

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <ThemeProvider>
        <SpecimenGridLayout title="Scan History" eyebrow="Viewport plate" actions={<button>Export</button>}>
          <p>content</p>
        </SpecimenGridLayout>
      </ThemeProvider>
    </MemoryRouter>
  );

const VIEWPORTS = [
  { name: "mobile", w: 393, h: 717 },
  { name: "tablet", w: 768, h: 1024 },
  { name: "desktop", w: 1280, h: 900 },
];

describe("Specimen Grid responsiveness", () => {
  it.each(VIEWPORTS)("renders the shell without horizontal overflow classes at $name", ({ w, h }) => {
    setViewport(w, h);
    renderShell();
    const main = document.getElementById("specimen-main")!;
    // Fluid container: full width, capped, with viewport-scaled gutters.
    expect(main.className).toContain("w-full");
    expect(main.className).toContain("max-w-6xl");
    expect(main.className).toMatch(/\bpx-4\b/);
    expect(main.className).toMatch(/sm:px-6/);
    expect(main.className).toMatch(/lg:px-10/);
  });

  it("keeps the masthead title wrapping instead of overflowing on narrow screens", () => {
    setViewport(393, 717);
    renderShell();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("break-words");
    expect(h1.className).toContain("min-w-0");
  });

  it("hides the dateline on mobile and shows it from the sm breakpoint up", () => {
    setViewport(393, 717);
    renderShell();
    const dateline = screen.getByText(/Specimen Index/);
    expect(dateline.className).toContain("hidden");
    expect(dateline.className).toContain("sm:inline");
  });

  it("uses dynamic viewport height so mobile browser chrome cannot clip the shell", () => {
    setViewport(393, 717);
    const { container } = renderShell();
    expect(container.querySelector("[data-specimen-shell]")!.className).toContain("min-h-dvh");
  });

  it("leaves clearance below content for the fixed bottom nav on every viewport", () => {
    for (const v of VIEWPORTS) {
      setViewport(v.w, v.h);
      const { unmount } = renderShell();
      const main = document.getElementById("specimen-main")!;
      expect(main.className).toMatch(/pb-40/);
      expect(main.className).toMatch(/md:pb-32/);
      unmount();
    }
  });

  it("gives every bottom-nav tab a 44px-class tap target", () => {
    setViewport(393, 717);
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const tabs = within(nav).getAllByRole("button");
    expect(tabs).toHaveLength(4);
    for (const t of tabs) expect(t.className).toContain("min-h-11");
  });
});

describe("Specimen Grid accessibility", () => {
  beforeEach(() => setViewport(1280, 900));

  it("exposes a skip link to the main landmark", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#specimen-main");
    expect(document.getElementById("specimen-main")).toBeTruthy();
  });

  it("labels the single main landmark with the page title", () => {
    renderShell();
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAccessibleName("Scan History");
  });

  it("labels the masthead action group", () => {
    renderShell();
    expect(screen.getByRole("group", { name: "Page actions" })).toBeInTheDocument();
  });

  it("names each bottom-nav tab and marks the active route", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Dashboard index" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Scan a garment" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Scan history closet" })).toBeInTheDocument();
  });

  it("moves focus across bottom-nav tabs with arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <BottomNav />
      </MemoryRouter>
    );
    const [index, scan, catalog, closet] = screen.getAllByRole("button");
    index.focus();
    await user.keyboard("{ArrowRight}");
    expect(scan).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(catalog).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(closet).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(index).toHaveFocus(); // wraps
    await user.keyboard("{End}");
    expect(closet).toHaveFocus();
    await user.keyboard("{Home}");
    expect(index).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(closet).toHaveFocus(); // wraps backwards
  });

  it("reaches the bottom nav by tabbing (no positive tabIndex traps)", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(document.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])')).toHaveLength(0);
    await user.tab();
    expect(screen.getByRole("link", { name: /skip to content/i })).toHaveFocus();
  });

  it("keeps a visible focus ring rule on nav tabs", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const t of within(nav).getAllByRole("button")) {
      expect(t.className).toContain("focus-visible:outline");
    }
  });

  it("exposes the theme toggle as a labelled pressable group", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByRole("group", { name: "Color theme" })).toBeInTheDocument();
    const dark = screen.getByRole("button", { name: "Dark theme" });
    await user.click(dark);
    expect(dark).toHaveAttribute("aria-pressed", "true");
  });
});

describe("theme persistence", () => {
  it("writes the selection to localStorage and restores it on remount", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    const first = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(window.localStorage.getItem("habi-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    first.unmount();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
