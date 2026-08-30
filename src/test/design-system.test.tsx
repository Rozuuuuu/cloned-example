import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SpecimenGridLayout from "@/components/SpecimenGridLayout";
import { SpecimenEmpty, SpecimenSkeletonList } from "@/components/SpecimenStates";

const root = process.cwd();
const css = readFileSync(path.join(root, "src/index.css"), "utf8");
const tw = readFileSync(path.join(root, "tailwind.config.ts"), "utf8");

const renderShell = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <SpecimenGridLayout title="Scan History" eyebrow="Test plate">
        {ui}
      </SpecimenGridLayout>
    </MemoryRouter>
  );

describe("Specimen Grid design contract", () => {
  it("keeps the hard-edged radius token at zero", () => {
    expect(css).toMatch(/--radius:\s*0(rem|px)?\s*;/);
    expect(tw).toMatch(/borderRadius/);
  });

  it("defines the specimen shadow token in both themes", () => {
    const matches = css.match(/--shadow-card:\s*6px 6px 0 0 hsl\(var\(--deep-sage\)\)/g);
    expect(matches?.length).toBe(2); // light + dark
  });

  it("exposes the typography scale used across every screen", () => {
    for (const cls of [".type-h1", ".type-h2", ".type-h3", ".type-body", ".type-label", ".type-mono"]) {
      expect(css).toContain(cls);
    }
  });

  it("inverts the palette for dark mode without renaming tokens", () => {
    const dark = css.slice(css.indexOf(".dark"));
    for (const token of ["--cream", "--deep-sage", "--sage-green", "--terracotta"]) {
      expect(dark).toContain(token);
    }
  });

  it("renders one masthead with 2px ink rules", () => {
    renderShell(<p>content</p>);
    const masthead = screen.getByTestId("specimen-masthead");
    expect(masthead.className).toContain("border-b-2");
    expect(masthead.className).toContain("bg-deep-sage");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scan History");
  });

  it("renders the persistent nav inside the shell", () => {
    renderShell(<p>content</p>);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("draws the empty state as a ruled specimen plate, never a rounded pill", () => {
    render(<SpecimenEmpty index="00" title="No specimens catalogued" note="Nothing yet." />);
    const plate = screen.getByTestId("specimen-empty");
    expect(plate.className).toContain("border-2");
    expect(plate.className).not.toMatch(/rounded-(sm|md|lg|xl|2xl|3xl|full)/);
    expect(plate.getAttribute("style")).toContain("var(--shadow-card)");
  });

  it("announces the skeleton state and keeps hard edges", () => {
    render(<SpecimenSkeletonList rows={3} />);
    const sk = screen.getByTestId("specimen-skeleton");
    expect(sk).toHaveAttribute("aria-busy", "true");
    expect(sk.className).toContain("border-2");
    expect(sk.querySelectorAll(".habi-shimmer").length).toBeGreaterThanOrEqual(9);
  });
});

describe("no UI drift back to generic styling", () => {
  const files = [
    "src/pages/History.tsx",
    "src/pages/Result.tsx",
    "src/components/BottomNav.tsx",
    "src/components/SpecimenGridLayout.tsx",
  ];

  it.each(files)("%s uses no rounded utilities", (f) => {
    const src = readFileSync(path.join(root, f), "utf8");
    expect(src).not.toMatch(/rounded-(sm|md|lg|xl|2xl|3xl)\b/);
  });

  it.each(files)("%s hardcodes no raw colors", (f) => {
    const src = readFileSync(path.join(root, f), "utf8");
    expect(src).not.toMatch(/\b(bg|text|border)-(white|black)\b/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});
