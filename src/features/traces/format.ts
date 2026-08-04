/** Small display helpers shared by the Traces list and detail panes. */

const UNITS = ["B", "KB", "MB", "GB"];

/** 30363 -> "29.7 KB". Sizes come from the list response's `sizeBytes`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

/** Milliseconds -> a compact "1h 2m" / "3m 04s" / "820ms" reading. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** Thousands separators for token counts. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Stable identity of one trace file within an agent. */
export function traceKey(sessionId: string, index: number): string {
  return `${sessionId}#${index}`;
}
