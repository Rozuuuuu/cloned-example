import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
  Toaster: () => null,
}));

let pdfShouldFail = false;
let csvShouldFail = false;
let pdfFailMessage: unknown = new Error("boom");
let csvFailMessage: unknown = new Error("boom");

vi.mock("@/lib/security", () => ({
  getScanFindings: vi.fn(async () => ({ rows: [], total: 0 })),
  getConnectorFindings: vi.fn(async () => ({ rows: [], total: 0 })),
  rescanAndReview: vi.fn(async () => true),
  fullRescan: vi.fn(async () => ({ ok: true, scans: 0, ingested: 0 })),
  severityRationale: () => "",
  toFindingsCsv: vi.fn(() => {
    if (csvShouldFail) throw csvFailMessage;
    return "id\n";
  }),
  toFindingsPdf: vi.fn(() => {
    if (pdfShouldFail) throw pdfFailMessage;
  }),
  clearSecurityCache: vi.fn(),
  severityClasses: new Proxy({}, { get: () => "" }),
  severityRank: { critical: 5, high: 4, medium: 3, low: 2, info: 1 },
  statusClasses: new Proxy({}, { get: () => "" }),
}));

beforeEach(() => {
  pdfShouldFail = false;
  csvShouldFail = false;
  pdfFailMessage = new Error("boom");
  csvFailMessage = new Error("boom");
  toastSuccess.mockClear();
  toastError.mockClear();
  // @ts-expect-error jsdom stub
  URL.createObjectURL = vi.fn(() => "blob:x");
  // @ts-expect-error jsdom stub
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => cleanup());

import SecurityIssues from "@/components/SecurityIssues";

const renderPanel = () =>
  render(
    <MemoryRouter>
      <SecurityIssues scanId="scan-1" />
    </MemoryRouter>
  );

const announcer = () => screen.getByTestId("export-sr-announcer");
const csvBtn = () =>
  screen.getByRole("button", { name: /Export CSV|Retrying CSV|Exporting/ });
const pdfBtn = () =>
  screen.getByRole("button", { name: /Export PDF|Retrying PDF|Exporting/ });

describe("SecurityIssues — aria-live export announcements", () => {
  it("CSV: announces completion without attempt number on first success", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() =>
      expect(announcer().textContent).toMatch(/CSV export completed$/)
    );
  });

  it("PDF: announces completion without attempt number on first success", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
    await waitFor(() =>
      expect(announcer().textContent).toMatch(/PDF export completed$/)
    );
  });

  it("CSV retry: announces attempt 2 on retry start and completion", async () => {
    csvShouldFail = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() =>
      expect(announcer().textContent).toMatch(
        /CSV export failed on attempt 1\. Last error: boom/
      )
    );
    csvShouldFail = false;
    const call = toastError.mock.calls.find((c) =>
      String(c[0]).includes("CSV export failed")
    );
    expect(call).toBeTruthy();
    (call![1] as { action: { onClick: () => void } }).action.onClick();
    await waitFor(() =>
      expect(announcer().textContent).toBe("CSV export completed on attempt 2")
    );
  });

  it("PDF retry: announces attempt 2 on retry start and completion", async () => {
    pdfShouldFail = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
    await waitFor(() =>
      expect(announcer().textContent).toMatch(
        /PDF export failed on attempt 1\. Last error: boom/
      )
    );
    pdfShouldFail = false;
    const call = toastError.mock.calls.find((c) =>
      String(c[0]).includes("PDF export failed")
    );
    (call![1] as { action: { onClick: () => void } }).action.onClick();
    await waitFor(() =>
      expect(announcer().textContent).toBe("PDF export completed on attempt 2")
    );
  });

  it("failure toast falls back to 'Last error: unavailable' when error has no message", async () => {
    csvShouldFail = true;
    csvFailMessage = null;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const call = toastError.mock.calls.find((c) =>
      String(c[0]).includes("CSV export failed")
    );
    expect((call![1] as { description: string }).description).toBe(
      "Last error: unavailable"
    );
  });

  it("aria-live region has role=status and aria-live=polite", () => {
    renderPanel();
    const el = announcer();
    expect(el).toHaveAttribute("role", "status");
    expect(el).toHaveAttribute("aria-live", "polite");
  });
});

describe("SecurityIssues — export buttons prevent overlapping retries", () => {
  it("both export buttons disable during a CSV export; extra clicks are ignored", async () => {
    const mod = await import("@/lib/security");
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    (mod.getConnectorFindings as unknown as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async () => ({ rows: [], total: 0 }))
      .mockImplementationOnce(async () => {
        await gate;
        return { rows: [], total: 0 };
      });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(csvBtn()).toBeDisabled());
    expect(pdfBtn()).toBeDisabled();

    fireEvent.click(csvBtn());
    fireEvent.click(pdfBtn());

    release();
    await waitFor(() =>
      expect(announcer().textContent).toMatch(/CSV export completed/)
    );
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });
});
