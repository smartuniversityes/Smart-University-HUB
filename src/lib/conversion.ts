import "server-only";
import { execFile } from "node:child_process";
import { access, readdir, readFile, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { cleanupJobDirs, getJobProfileDir, getJobTmpDir, prepareJobDirs } from "@/lib/storage";
import { CONVERTIBLE_EXTENSIONS } from "@/lib/file-types";

const execFileAsync = promisify(execFile);

export type EngineName = "libreoffice" | "office-com";

export type ConversionResult = {
  engine: EngineName;
  /** the produced PDF, ready to be written into uploads/previews */
  pdf: Buffer;
  durationMs: number;
};

const CONVERT_TIMEOUT_MS = 120_000;

/* ------------------------------------------------------------------ *
 * Engine detection
 * ------------------------------------------------------------------ */

const LIBREOFFICE_CANDIDATES = [
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

const OFFICE_CANDIDATES = [
  "C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
  "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
  "C:\\Program Files\\Microsoft Office\\Office16\\POWERPNT.EXE",
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * LibreOffice is the engine that works everywhere, including a Linux VPS, so it
 * is always preferred. The Microsoft Office COM path is a convenience for
 * development on a Windows machine that already has Office installed.
 */
export async function detectEngine(): Promise<EngineName | null> {
  for (const candidate of LIBREOFFICE_CANDIDATES) {
    if (await exists(candidate)) return "libreoffice";
  }
  if (process.platform === "win32") {
    for (const candidate of OFFICE_CANDIDATES) {
      if (await exists(candidate)) return "office-com";
    }
  }
  return null;
}

export async function engineAvailable(): Promise<boolean> {
  return (await detectEngine()) !== null;
}

/* ------------------------------------------------------------------ *
 * LibreOffice
 * ------------------------------------------------------------------ */

async function findSofficeBinary(): Promise<string | null> {
  for (const candidate of LIBREOFFICE_CANDIDATES) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function convertWithLibreOffice(
  sourcePath: string,
  jobId: string,
  outputDir: string,
): Promise<string> {
  const soffice = await findSofficeBinary();
  if (!soffice) throw new Error("LibreOffice is not installed");

  // A headless LibreOffice locks its user profile, so a second concurrent run
  // against the same profile fails silently. Each job therefore gets its own
  // throwaway profile directory. The profile argument must be a properly
  // percent-encoded file:// URL, or a project directory containing spaces makes
  // LibreOffice bail out before even opening the source file.
  const profileDir = getJobProfileDir(jobId);
  const profileUrl = pathToFileURL(profileDir).toString();

  try {
    await execFileAsync(
      soffice,
      [
        "--headless",
        "--norestore",
        "--invisible",
        "--nolockcheck",
        "--nodefault",
        `-env:UserInstallation=${profileUrl}`,
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        sourcePath,
      ],
      // soffice.exe expects to be started from its own program directory; a
      // different CWD makes it fail with "Could not find platform independent
      // libraries <prefix>" before doing any work.
      { timeout: CONVERT_TIMEOUT_MS, windowsHide: true, cwd: path.dirname(soffice) },
    );
  } catch (error) {
    throw new ConversionError(describeSofficeFailure(error));
  }

  const produced = (await readdir(outputDir)).filter((name) => name.toLowerCase().endsWith(".pdf"));
  if (produced.length === 0) {
    throw new Error("LibreOffice produced no PDF output");
  }
  return path.join(outputDir, produced[0]);
}

/** Turns an execFile error into something useful: exit code plus any stderr. */
function describeSofficeFailure(error: unknown): string {
  if (error instanceof Error) {
    const details = error as Error & { code?: string | number; stderr?: string };
    return [
      "LibreOffice conversion failed.",
      details.code ? `exit code ${details.code}.` : undefined,
      details.stderr?.trim() || undefined,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return "LibreOffice conversion failed.";
}

/* ------------------------------------------------------------------ *
 * Microsoft Office (COM automation via PowerShell)
 * ------------------------------------------------------------------ */

const COM_SCRIPT = `
$ErrorActionPreference = 'Stop'
$source = $args[0]
$target = $args[1]
$kind   = $args[2]
$app = $null
try {
  switch ($kind) {
    'ppt' { $app = New-Object -ComObject PowerPoint.Application }
    'doc' { $app = New-Object -ComObject Word.Application; $app.Visible = $false }
    'xls' { $app = New-Object -ComObject Excel.Application; $app.Visible = $false }
    default { throw "Unsupported kind: $kind" }
  }
  switch ($kind) {
    'ppt' {
      # 32 = ppFixedFormatTypePDF, 2 = ppFixedFormatIntentPrint
      $deck = $app.Presentations.Open($source, $true, $false, $false)
      $deck.SaveAs($target, 32)
      $deck.Close()
    }
    'doc' {
      $doc = $app.Documents.Open($source, $false, $true)
      $doc.SaveAs([ref]$target, [ref]17)
      $doc.Close([ref]$false)
    }
    'xls' {
      $wb = $app.Workbooks.Open($source, $false, $true)
      $wb.ExportAsFixedFormat(0, $target)
      $wb.Close($false)
    }
  }
} finally {
  if ($app) { $app.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect()
}
`;

function comKindFor(extension: string): "ppt" | "doc" | "xls" {
  if (extension === "ppt" || extension === "pptx") return "ppt";
  if (extension === "doc" || extension === "docx") return "doc";
  return "xls";
}

async function convertWithOfficeCom(
  sourcePath: string,
  extension: string,
  jobId: string,
  outputDir: string,
): Promise<string> {
  const target = path.join(outputDir, `${path.parse(sourcePath).name}.pdf`);

  // PowerShell 5.1 can deadlock when COM is driven from an existing thread, so
  // the work runs in a freshly spawned process instead of in this one.
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );

  await execFileAsync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", COM_SCRIPT, sourcePath, target, comKindFor(extension)],
    { timeout: CONVERT_TIMEOUT_MS, windowsHide: true },
  );

  if (!(await exists(target))) {
    throw new Error("Microsoft Office produced no PDF output");
  }
  return target;
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export class ConversionError extends Error {}

/**
 * Converts an office document to PDF. `sourcePath` is a path inside the
 * uploads tree; the returned buffer is never written to disk by this function.
 */
export async function convertToPdf(
  sourcePath: string,
  extension: string,
  jobId: string,
): Promise<ConversionResult> {
  if (!CONVERTIBLE_EXTENSIONS.includes(extension)) {
    throw new ConversionError(`Cannot convert .${extension} files`);
  }

  const started = Date.now();
  await prepareJobDirs(jobId);
  const outputDir = getJobTmpDir(jobId);
  const sourceStats = await stat(sourcePath);

  try {
    const engine = await detectEngine();
    if (!engine) {
      throw new ConversionError(
        "No conversion engine found. Install LibreOffice to preview PowerPoint, Word and Excel files.",
      );
    }

    let producedPath: string;
    if (engine === "libreoffice") {
      producedPath = await convertWithLibreOffice(sourcePath, jobId, outputDir);
    } else {
      producedPath = await convertWithOfficeCom(sourcePath, extension, jobId, outputDir);
    }

    // The path is a conversion artefact created at runtime inside the uploads
    // tree, so it must not be traced into the deployment bundle.
    const pdf = await readFile(/* turbopackIgnore: true */ producedPath);
    if (pdf.length === 0 || sourceStats.size === 0) {
      throw new ConversionError("Conversion produced an empty file");
    }
    // A real PDF starts with the %PDF- magic bytes. Guards against an engine
    // that exits successfully but writes an error page instead.
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new ConversionError("Conversion output was not a valid PDF");
    }

    return { engine, pdf, durationMs: Date.now() - started };
  } finally {
    await cleanupJobDirs(jobId);
  }
}

/** Copies an uploaded file into a job's scratch directory before conversion. */
export async function stageForConversion(
  storedName: string,
  extension: string,
  jobId: string,
): Promise<string> {
  await prepareJobDirs(jobId);
  const { getOriginalPath } = await import("@/lib/storage");
  const staged = path.join(getJobTmpDir(jobId), `source.${extension}`);
  await copyFile(getOriginalPath(storedName), staged);
  return staged;
}

export const TMP_ROOT = os.tmpdir();
