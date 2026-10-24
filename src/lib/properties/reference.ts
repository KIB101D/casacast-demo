export const REFERENCE_PREFIX = "CB-";

/** "CB-0009" → "CB-0010". Starts at CB-0001 when there is no previous reference. */
export function nextReference(last: string | null | undefined): string {
  const lastNumber = last?.startsWith(REFERENCE_PREFIX)
    ? Number.parseInt(last.slice(REFERENCE_PREFIX.length), 10)
    : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${REFERENCE_PREFIX}${String(next).padStart(4, "0")}`;
}
