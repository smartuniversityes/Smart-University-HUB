import "server-only";
import { readFile } from "node:fs/promises";
import { getOriginalPath, getPreviewPath, isSafeStoredName } from "@/lib/storage";

/**
 * Turns an uploaded material into plain text pieces the chatbot can index.
 *
 * Each piece carries a label ("Slide 3", "Page 12") when the format tells us
 * where the text came from, because a citation that points at a slide number
 * is far more useful to a student than one that points at a whole file.
 *
 * Strategy per format:
 *   txt/md/csv/log  read the file directly
 *   pdf             unpdf extracts per-page text
 *   pptx/docx/xlsx  unzip the OOXML and pull the text runs out of the XML
 *   ppt/doc/xls     legacy binary formats cannot be parsed here, so fall back
 *                   to the converted preview PDF when one exists
 */

export type ExtractedPiece = {
  /** "Slide 3" / "Page 12" / null when the format has no page concept */
  label: string | null;
  text: string;
};

/** Total text kept per material; anything beyond this is dropped. */
const MAX_TOTAL_CHARS = 400_000;
/** A single piece larger than this is split so embeddings stay meaningful. */
const MAX_PIECE_CHARS = 8_000;

export class ExtractionError extends Error {}

export async function extractText(
  storedName: string,
  extension: string,
  previewPath: string | null,
): Promise<ExtractedPiece[]> {
  if (!isSafeStoredName(storedName)) {
    throw new ExtractionError("Stored file name is not valid");
  }

  let pieces: ExtractedPiece[];
  switch (extension) {
    case "txt":
    case "md":
    case "csv":
    case "log":
      pieces = await extractPlain(storedName);
      break;
    case "pdf":
      pieces = await extractPdf(await readOriginal(storedName));
      break;
    case "pptx":
      pieces = await extractPptx(await readOriginal(storedName));
      break;
    case "docx":
      pieces = await extractDocx(await readOriginal(storedName));
      break;
    case "xlsx":
      pieces = await extractXlsx(await readOriginal(storedName));
      break;
    case "ppt":
    case "doc":
    case "xls":
      // Legacy binary formats are only readable through their converted PDF.
      pieces = previewPath ? await extractPreviewPdf(previewPath) : [];
      break;
    default:
      pieces = [];
  }

  return trimPieces(pieces);
}

async function readOriginal(storedName: string): Promise<Buffer> {
  try {
    return await readFile(getOriginalPath(storedName));
  } catch {
    throw new ExtractionError("The stored file is missing on disk.");
  }
}

/* ------------------------------------------------------------------ *
 * Plain text
 * ------------------------------------------------------------------ */

async function extractPlain(storedName: string): Promise<ExtractedPiece[]> {
  const buffer = await readOriginal(storedName);
  return [{ label: null, text: buffer.toString("utf8") }];
}

/* ------------------------------------------------------------------ *
 * PDF (via unpdf)
 * ------------------------------------------------------------------ */

async function extractPdf(buffer: Buffer): Promise<ExtractedPiece[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(result.text) ? result.text : [result.text];
  } catch (error) {
    throw new ExtractionError(
      `Could not read this PDF${error instanceof Error ? ` (${error.message})` : ""}.`,
    );
  }

  return pages
    .map((text, index) => ({ label: `Page ${index + 1}`, text }))
    .filter((piece) => piece.text.trim().length > 0);
}

async function extractPreviewPdf(previewPath: string): Promise<ExtractedPiece[]> {
  let buffer: Buffer;
  try {
    buffer = await readFile(getPreviewPath(previewPath));
  } catch {
    return [];
  }
  try {
    return await extractPdf(buffer);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * OOXML (pptx / docx / xlsx) via jszip
 * ------------------------------------------------------------------ */

/** Unescapes the five XML entities plus numeric character references. */
function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Pulls every run of text out of an OOXML fragment, in document order. */
function collectRuns(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  let out = "";
  for (const match of xml.matchAll(pattern)) {
    out += unescapeXml(match[1]);
  }
  return out;
}

async function loadZip(buffer: Buffer) {
  const JSZip = (await import("jszip")).default;
  try {
    return await JSZip.loadAsync(buffer);
  } catch {
    throw new ExtractionError("This file could not be opened as an archive.");
  }
}

/** "ppt/slides/slide12.xml" -> 12, so slides sort numerically. */
function slideNumber(path: string): number {
  const match = /slide(\d+)\.xml$/.exec(path);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

async function extractPptx(buffer: Buffer): Promise<ExtractedPiece[]> {
  const zip = await loadZip(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const pieces: ExtractedPiece[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("string");
    // <a:t> holds the text runs on a slide.
    const text = collectRuns(xml, "a:t");
    if (text.trim().length > 0) {
      pieces.push({ label: `Slide ${slideNumber(path)}`, text });
    }
  }
  return pieces;
}

async function extractDocx(buffer: Buffer): Promise<ExtractedPiece[]> {
  const zip = await loadZip(buffer);
  const entry = zip.files["word/document.xml"];
  if (!entry) return [];

  const xml = await entry.async("string");
  // Split on paragraph marks so the extracted text keeps its line breaks,
  // then pull the <w:t> text runs out of each paragraph.
  const paragraphs = xml.split("</w:p>");
  const pieces: ExtractedPiece[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    const text = collectRuns(paragraph, "w:t");
    if (text.trim().length === 0) continue;
    current.push(text);
    currentLength += text.length;
    if (currentLength >= MAX_PIECE_CHARS) {
      pieces.push({ label: null, text: current.join("\n") });
      current = [];
      currentLength = 0;
    }
  }
  if (current.length > 0) pieces.push({ label: null, text: current.join("\n") });
  return pieces;
}

async function extractXlsx(buffer: Buffer): Promise<ExtractedPiece[]> {
  const zip = await loadZip(buffer);

  // The shared-strings table holds every distinct text cell in the workbook.
  // Numbers and formulas stay in the sheet XML and are not useful as study
  // material context, so pulling the strings is the honest 90% solution.
  const entry = zip.files["xl/sharedStrings.xml"];
  if (!entry) return [];

  const xml = await entry.async("string");
  const pieces: ExtractedPiece[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const match of xml.matchAll(/<si[\s\S]*?<\/si>/g)) {
    const text = collectRuns(match[0], "t");
    if (text.trim().length === 0) continue;
    current.push(text);
    currentLength += text.length;
    if (currentLength >= MAX_PIECE_CHARS) {
      pieces.push({ label: null, text: current.join("\n") });
      current = [];
      currentLength = 0;
    }
  }
  if (current.length > 0) pieces.push({ label: null, text: current.join("\n") });
  return pieces;
}

/* ------------------------------------------------------------------ *
 * Shared trimming
 * ------------------------------------------------------------------ */

function trimPieces(pieces: ExtractedPiece[]): ExtractedPiece[] {
  const out: ExtractedPiece[] = [];
  let total = 0;

  for (const piece of pieces) {
    if (total >= MAX_TOTAL_CHARS) break;
    let text = piece.text;
    if (text.length > MAX_PIECE_CHARS) text = text.slice(0, MAX_PIECE_CHARS);
    if (total + text.length > MAX_TOTAL_CHARS) {
      text = text.slice(0, MAX_TOTAL_CHARS - total);
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    out.push({ label: piece.label, text: trimmed });
    total += trimmed.length;
  }

  return out;
}
