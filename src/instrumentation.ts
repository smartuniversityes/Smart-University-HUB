/**
 * Runs once when a server instance starts, before it handles requests. Used to
 * pick up preview conversions that were interrupted by a previous process, so a
 * crash mid-conversion never leaves material stuck on "converting".
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recoverStaleJobs } = await import("@/lib/preview-queue");
  try {
    await recoverStaleJobs();
  } catch (error) {
    // A failure here must not stop the server from booting.
    console.error("Failed to recover stale preview jobs", error);
  }
}
