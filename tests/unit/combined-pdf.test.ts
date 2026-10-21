import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildCombinedPdf } from "@/features/imports/combined-pdf";

/* Pins "Download Document" (src/features/imports/combined-pdf.ts): what goes into the combined PDF. */

// A valid 1 × 1 PNG.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < count; index++) pdf.addPage();
  return pdf.save();
}

describe("Download Document", () => {
  it("puts a contents page first, then every page of every PDF and one page per image", async () => {
    const bytes = await buildCombinedPdf({
      heading: "Documents of import ACME/IMP/20261000001",
      details: ["SEA CONTAINER IMPORT · Acme Ltd (ACME)"],
      files: [
        { label: "Bill of Lading", name: "bl.pdf", contentType: "application/pdf", bytes: await pdfWithPages(2) },
        { label: "Packing List", name: "list.png", contentType: "image/png", bytes: PNG },
        { label: "NEPZA Letter", name: "letter.pdf", contentType: "application/pdf", bytes: await pdfWithPages(1) },
      ],
    });
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(1 + 2 + 1 + 1);
  });

  it("leaves out what cannot go into a PDF, is missing or unreadable, and still produces a file", async () => {
    const bytes = await buildCombinedPdf({
      heading: "Documents of import X",
      details: [],
      files: [
        { label: "Others", name: "all.zip", contentType: "application/zip", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) },
        { label: "Invoice", name: "gone.pdf", contentType: "application/pdf", bytes: null },
        { label: "Invoice", name: "broken.pdf", contentType: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.7 not really") },
        { label: "Photo", name: "fake.png", contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) },
      ],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("copes with names the standard PDF font cannot draw", async () => {
    const bytes = await buildCombinedPdf({
      heading: "Documents of import 导入",
      details: ["Société · ₦"],
      files: [{ label: "Lettre", name: "lettre-d’agrément.pdf", contentType: "application/pdf", bytes: await pdfWithPages(1) }],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
