import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * All uploaded bytes live on the local disk, outside `public/`, so that files
 * are only reachable through authenticated route handlers.
 *
 *   uploads/originals/<uuid>.<ext>   the untouched file a professor uploaded
 *   uploads/previews/<uuid>.pdf       a PDF generated for in-browser preview
 *   uploads/tmp/<jobId>/              scratch space for a running conversion
 *   uploads/lo-profiles/<jobId>/      private LibreOffice profile per job
 */
// In production the uploads tree must live on the same persistent volume as the
// database, so its location is configurable. Defaults to <cwd>/uploads, which is
// what local development uses.
const UPLOAD_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");
const ORIGINALS_DIR = path.join(UPLOAD_ROOT, "originals");
const PREVIEWS_DIR = path.join(UPLOAD_ROOT, "previews");
const TMP_DIR = path.join(UPLOAD_ROOT, "tmp");
const PROFILES_DIR = path.join(UPLOAD_ROOT, "lo-profiles");

export async function ensureUploadDirs(): Promise<void> {
  await Promise.all(
    [ORIGINALS_DIR, PREVIEWS_DIR, TMP_DIR, PROFILES_DIR].map((dir) =>
      mkdir(dir, { recursive: true }),
    ),
  );
}

/**
 * Stored names are always server-generated `<uuid>.<ext>`. Validating before
 * use stops a crafted value from escaping the uploads directory.
 */
const SAFE_NAME = /^[a-zA-Z0-9_-]+\.[a-z0-9]{1,10}$/;

export function isSafeStoredName(name: string): boolean {
  return SAFE_NAME.test(name);
}

function assertInside(dir: string, name: string): string {
  if (!isSafeStoredName(name)) {
    throw new Error(`Unsafe stored file name: ${name}`);
  }
  const resolved = path.resolve(dir, name);
  if (path.dirname(resolved) !== path.resolve(dir)) {
    throw new Error(`Resolved path escaped upload directory: ${name}`);
  }
  return resolved;
}

export function getOriginalPath(storedName: string): string {
  return assertInside(ORIGINALS_DIR, storedName);
}

export function getPreviewPath(previewName: string): string {
  return assertInside(PREVIEWS_DIR, previewName);
}

/** Generates the on-disk name for a new upload. */
export function makeStoredName(extension: string): string {
  return `${randomUUID()}.${extension}`;
}

export function makePreviewName(): string {
  return `${randomUUID()}.pdf`;
}

/** Writes a buffer as a new original upload. */
export async function saveOriginal(buffer: Buffer, extension: string): Promise<string> {
  await ensureUploadDirs();
  const storedName = makeStoredName(extension);
  await writeFile(getOriginalPath(storedName), buffer);
  return storedName;
}

/**
 * Streams a request body to disk, aborting if it exceeds `maxBytes`.
 * Used by the upload route so a large file never has to sit in memory.
 */
export async function streamToOriginal(
  body: ReadableStream<Uint8Array>,
  extension: string,
  maxBytes: number,
): Promise<{ storedName: string; sizeBytes: number }> {
  await ensureUploadDirs();
  const storedName = makeStoredName(extension);
  const target = getOriginalPath(storedName);

  let received = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        controller.error(new Error("FILE_TOO_LARGE"));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(body.pipeThrough(counter) as never),
    createWriteStream(target),
  );

  return { storedName, sizeBytes: received };
}

export async function writePreview(buffer: Buffer): Promise<string> {
  await ensureUploadDirs();
  const previewName = makePreviewName();
  await writeFile(getPreviewPath(previewName), buffer);
  return previewName;
}

export async function readPreview(previewName: string): Promise<Buffer> {
  return readFile(getPreviewPath(previewName));
}

export async function readOriginal(storedName: string): Promise<Buffer> {
  return readFile(getOriginalPath(storedName));
}

export async function fileSize(filePath: string): Promise<number> {
  const info = await stat(filePath);
  return info.size;
}

export async function deleteOriginal(storedName: string): Promise<void> {
  await rm(getOriginalPath(storedName), { force: true });
}

export async function deletePreview(previewName: string): Promise<void> {
  await rm(getPreviewPath(previewName), { force: true });
}

export function getJobTmpDir(jobId: string): string {
  return path.join(TMP_DIR, jobId);
}

export function getJobProfileDir(jobId: string): string {
  return path.join(PROFILES_DIR, jobId);
}

export async function prepareJobDirs(jobId: string): Promise<void> {
  await mkdir(getJobTmpDir(jobId), { recursive: true });
  await mkdir(getJobProfileDir(jobId), { recursive: true });
}

export async function cleanupJobDirs(jobId: string): Promise<void> {
  await Promise.all([
    rm(getJobTmpDir(jobId), { recursive: true, force: true }),
    rm(getJobProfileDir(jobId), { recursive: true, force: true }),
  ]);
}

export { UPLOAD_ROOT, ORIGINALS_DIR, PREVIEWS_DIR };
