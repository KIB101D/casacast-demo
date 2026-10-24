/** Tries per sync before giving up and showing "Failed" with a Retry button. */
export const MAX_ATTEMPTS = 4;

/** 10 s, 30 s, 90 s: short enough to watch in the demo, long enough to ride out a blip. */
const BASE_DELAY_MS = 10_000;

/**
 * When to try again after `attempts` failures (1 after the first failure), or null to stop.
 * A channel's own hint (Telegram's retry_after) wins when it asks for longer.
 */
export function nextAttemptAt(
  attempts: number,
  now: Date,
  options: { retryable: boolean; retryAfterMs?: number },
): Date | null {
  if (!options.retryable || attempts >= MAX_ATTEMPTS) return null;
  const delay = Math.max(BASE_DELAY_MS * 3 ** (attempts - 1), options.retryAfterMs ?? 0);
  return new Date(now.getTime() + delay);
}
