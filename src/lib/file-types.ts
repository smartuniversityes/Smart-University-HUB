/**
 * Central definition of every uploadable file type, how big it may be,
 * and how its preview is produced.
 *
 * "pdf"     - the uploaded file is already a PDF, serve it directly
 * "text"    - read and render as text in the browser, no conversion
 * "convert" - needs a headless office engine to turn it into a PDF first
 * "none"    - no preview, download only
 */
export type PreviewMode = "pdf" | "text" | "convert" | "none";

export type FileKind = {
  /** human readable type name */
  label: string;
  /** short tag shown on cards, e.g. "PPT" */
  short: string;
  /** forced mime type, since browsers often send application/octet-stream */
  mime: string;
  preview: PreviewMode;
  /** tailwind classes for the type badge */
  accent: string;
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const FILE_KINDS: Record<string, FileKind> = {
  pdf: {
    label: "PDF document",
    short: "PDF",
    mime: "application/pdf",
    preview: "pdf",
    accent: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  pptx: {
    label: "PowerPoint presentation",
    short: "PPTX",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    preview: "convert",
    accent: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  ppt: {
    label: "PowerPoint presentation (legacy)",
    short: "PPT",
    mime: "application/vnd.ms-powerpoint",
    preview: "convert",
    accent: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  docx: {
    label: "Word document",
    short: "DOCX",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    preview: "convert",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  doc: {
    label: "Word document (legacy)",
    short: "DOC",
    mime: "application/msword",
    preview: "convert",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  xlsx: {
    label: "Excel spreadsheet",
    short: "XLSX",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    preview: "convert",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  xls: {
    label: "Excel spreadsheet (legacy)",
    short: "XLS",
    mime: "application/vnd.ms-excel",
    preview: "convert",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  txt: {
    label: "Plain text",
    short: "TXT",
    mime: "text/plain",
    preview: "text",
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  md: {
    label: "Markdown",
    short: "MD",
    mime: "text/markdown",
    preview: "text",
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  csv: {
    label: "CSV data",
    short: "CSV",
    mime: "text/csv",
    preview: "text",
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  log: {
    label: "Log file",
    short: "LOG",
    mime: "text/plain",
    preview: "text",
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  zip: {
    label: "ZIP archive",
    short: "ZIP",
    mime: "application/zip",
    preview: "none",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_KINDS);

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index + 1).toLowerCase();
}

export function getFileKind(extension: string): FileKind | undefined {
  return FILE_KINDS[extension.toLowerCase()];
}

export function isAllowedExtension(extension: string): boolean {
  return getFileKind(extension) !== undefined;
}

/** True when the type must be run through a conversion engine to be previewed. */
export function needsConversion(extension: string): boolean {
  return getFileKind(extension)?.preview === "convert";
}

export function isTextType(extension: string): boolean {
  return getFileKind(extension)?.preview === "text";
}

/** Extensions LibreOffice / Office can reliably turn into a PDF. */
export const CONVERTIBLE_EXTENSIONS = ALLOWED_EXTENSIONS.filter(
  (ext) => FILE_KINDS[ext].preview === "convert",
);
