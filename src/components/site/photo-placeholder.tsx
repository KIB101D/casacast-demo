/** Shown until a listing has photos: a plain glazed-tile grid rather than a broken image. */
export function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="text-muted flex h-full w-full items-center justify-center text-sm"
      style={{
        backgroundColor: "var(--color-canvas)",
        backgroundImage:
          "linear-gradient(var(--color-accent-soft) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent-soft) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <span className="bg-surface rounded px-3 py-1">{label}</span>
    </div>
  );
}
