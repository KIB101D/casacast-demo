import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`bg-line/50 animate-pulse rounded-xl ${className}`} />;
}

export function Notice({
  tone,
  children,
}: {
  tone: "ok" | "danger" | "warn";
  children: ReactNode;
}) {
  const styles = {
    ok: "bg-ok-soft text-ok",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
  } as const;
  return (
    <p role="status" className={`mb-4 rounded-lg px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </p>
  );
}
