import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/*
 * "Download Document" (old ViewImpExp mergePageToPdfAndDownload, which did this in the browser):
 * every file of an import in one PDF, in the page's order. PDFs are added page by page, PNG and
 * JPEG images one per page, scaled to fit. Other kinds (ZIP, GIF, TIFF) cannot go into a PDF, and
 * a PDF that cannot be read is left out too; the first page lists what is in the file and what was
 * left out, and why (the old one dropped them silently).
 */

export interface CombinedFile {
  /** What the file is ("Bill of Lading", "NEPZA Letter"). */
  label: string;
  name: string;
  contentType: string;
  /** null: the file is missing from the uploads folder. */
  bytes: Uint8Array | null;
}

/** All files together may not exceed this (memory): the rest are listed as left out. */
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

/** The standard PDF fonts only draw Latin-1 text: anything else becomes "?". */
const latin = (text: string) => text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

export async function buildCombinedPdf(input: { heading: string; details: string[]; files: CombinedFile[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const included: string[] = [];
  const skipped: { file: string; why: string }[] = [];
  const contents = pdf.addPage(A4); // filled in last, when it is known what went in
  let used = 0;

  for (const file of input.files) {
    const title = `${file.label}: ${file.name}`;
    if (!file.bytes) {
      skipped.push({ file: title, why: "missing from the uploads folder" });
      continue;
    }
    if (used + file.bytes.byteLength > MAX_TOTAL_BYTES) {
      skipped.push({ file: title, why: "too large to combine (download it on its own)" });
      continue;
    }
    try {
      if (file.contentType === "application/pdf") {
        const source = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
        const pages = await pdf.copyPages(source, source.getPageIndices());
        for (const page of pages) pdf.addPage(page);
      } else if (file.contentType === "image/png" || file.contentType === "image/jpeg") {
        const image = file.contentType === "image/png" ? await pdf.embedPng(file.bytes) : await pdf.embedJpg(file.bytes);
        const page = pdf.addPage(A4);
        page.drawText(latin(title).slice(0, 110), { x: MARGIN, y: A4[1] - MARGIN + 12, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        const box = { width: A4[0] - 2 * MARGIN, height: A4[1] - 2 * MARGIN - 16 };
        const scale = Math.min(box.width / image.width, box.height / image.height, 1);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, { x: (A4[0] - width) / 2, y: A4[1] - MARGIN - 16 - height, width, height });
      } else {
        skipped.push({ file: title, why: "a ZIP, GIF or TIFF cannot be put into a PDF (download it on its own)" });
        continue;
      }
      used += file.bytes.byteLength;
      included.push(title);
    } catch {
      skipped.push({ file: title, why: "could not be read as a PDF or image" });
    }
  }

  writeContents(pdf, contents, { font, bold }, input.heading, input.details, included, skipped);
  return pdf.save();
}

/** The first page: heading, details, what is in the file, what was left out. Continues on new pages when long. */
function writeContents(
  pdf: PDFDocument,
  first: PDFPage,
  fonts: { font: PDFFont; bold: PDFFont },
  heading: string,
  details: string[],
  included: string[],
  skipped: { file: string; why: string }[],
) {
  let page = first;
  let y = A4[1] - MARGIN;
  let insertAt = 1;
  const line = (text: string, options: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) => {
    const size = options.size ?? 10;
    if (y < MARGIN + size) {
      page = pdf.insertPage(insertAt++, A4);
      y = A4[1] - MARGIN;
    }
    page.drawText(latin(text).slice(0, 120), {
      x: MARGIN,
      y,
      size,
      font: options.bold ? fonts.bold : fonts.font,
      color: options.color ? rgb(...options.color) : rgb(0.1, 0.1, 0.1),
    });
    y -= size + (options.gap ?? 5);
  };

  line(heading, { size: 16, bold: true, gap: 10 });
  for (const detail of details) line(detail, { color: [0.35, 0.35, 0.35] });
  y -= 10;
  line(`In this file (${included.length})`, { size: 12, bold: true, gap: 8 });
  if (included.length === 0) line("No file could be combined.", { color: [0.35, 0.35, 0.35] });
  included.forEach((title, index) => line(`${index + 1}. ${title}`));
  if (skipped.length > 0) {
    y -= 10;
    line(`Left out (${skipped.length})`, { size: 12, bold: true, gap: 8 });
    for (const item of skipped) {
      line(item.file);
      line(`   ${item.why}`, { color: [0.6, 0.1, 0.1] });
    }
  }
}
