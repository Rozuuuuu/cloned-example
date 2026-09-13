import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { metricsFor } from "@/lib/catalog";
import type { ScanRecord } from "@/lib/habi";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Catalog specimens → CSV, one row per specimen with grade, metrics and photo URL. */
export const toSpecimensCsv = (
  scans: ScanRecord[],
  images: Record<string, string> = {}
): string => {
  const header = [
    "id",
    "fabric_name",
    "grade",
    "fiber_type",
    "breathability",
    "sustainability",
    "scanned_at",
    "photo",
  ];
  const lines = scans.map((s) => {
    const m = metricsFor(s.grade);
    const photo = images[s.id] ?? s.imagePath ?? "";
    return [
      esc(s.id),
      esc(s.fabricName),
      esc(s.grade),
      esc(s.fiberType),
      esc(m.breathability),
      esc(m.sustainability),
      esc(s.scannedAt),
      esc(photo.startsWith("data:") ? "embedded" : photo),
    ].join(",");
  });
  return [header.join(","), ...lines].join("\n");
};

/** Triggers a browser download for text content. */
export const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const toDataUrl = async (url: string): Promise<string | null> => {
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** Catalog specimens → PDF, each row carrying its own photo, grade and metrics. */
export const toSpecimensPdf = async (
  scans: ScanRecord[],
  images: Record<string, string> = {},
  opts: { filename?: string; subtitle?: string } = {}
): Promise<void> => {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Specimen Catalog", 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(opts.subtitle ?? `${scans.length} specimen(s)`, 14, 20);
  doc.setTextColor(0);

  const photos = await Promise.all(
    scans.map(async (s) => (images[s.id] ? await toDataUrl(images[s.id]) : null))
  );

  autoTable(doc, {
    startY: 26,
    head: [["Photo", "Fabric", "Grade", "Fiber", "Breathability", "Sustainability", "Scanned"]],
    body: scans.map((s) => {
      const m = metricsFor(s.grade);
      return [
        "",
        s.fabricName,
        s.grade,
        s.fiberType,
        `${m.breathability}%`,
        `${m.sustainability}%`,
        new Date(s.scannedAt).toISOString().slice(0, 10),
      ];
    }),
    styles: { fontSize: 9, cellPadding: 2, minCellHeight: 20, valign: "middle" },
    columnStyles: { 0: { cellWidth: 24 } },
    headStyles: { fillColor: [30, 45, 35] },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const img = photos[data.row.index];
      if (!img) return;
      try {
        doc.addImage(img, data.cell.x + 2, data.cell.y + 2, 18, 16);
      } catch {
        /* unsupported image — leave the cell blank */
      }
    },
  });

  doc.save(opts.filename ?? `specimen-catalog-${Date.now()}.pdf`);
};
