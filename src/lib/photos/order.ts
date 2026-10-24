/** Returns a new array with the item at `from` moved to `to`. Out-of-range moves return a copy. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) {
    return result;
  }
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved!);
  return result;
}

/** True when `proposed` contains exactly the ids in `current`, each once, in any order. */
export function isSameSet(current: readonly string[], proposed: readonly string[]) {
  if (current.length !== proposed.length) return false;
  const remaining = new Set(current);
  for (const id of proposed) {
    if (!remaining.delete(id)) return false;
  }
  return remaining.size === 0;
}

/**
 * After deleting a photo, which one should be the cover?
 * Keeps the current cover if it survives, otherwise the first remaining photo.
 */
export function coverAfterDelete(
  photos: readonly { id: string; isCover: boolean }[],
  deletedId: string,
): string | null {
  const remaining = photos.filter((p) => p.id !== deletedId);
  return (remaining.find((p) => p.isCover) ?? remaining[0])?.id ?? null;
}
