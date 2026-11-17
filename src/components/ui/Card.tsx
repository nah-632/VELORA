import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "recipe" | "dark";
}) {
  const tones = {
    paper: "bg-ground-paper border-line text-ink",
    recipe: "bg-ground-recipe border-line text-ink",
    dark: "bg-ground-dark border-brand-emerald-deep text-ink-inverse",
  } as const;

  return (
    <div className={`rounded-lg border p-6 ${tones[tone]} ${className}`.trim()}>{children}</div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      {children ? <p className="max-w-prose text-ink-muted">{children}</p> : null}
    </header>
  );
}

/** Loading, empty and error states as one component, so none of them can be forgotten. */
export function StatePanel({
  kind,
  message,
  action,
}: {
  kind: "loading" | "empty" | "error" | "success";
  message: string;
  action?: ReactNode;
}) {
  const styles = {
    loading: "border-line bg-ground-recipe text-ink-muted",
    empty: "border-line bg-ground-recipe text-ink-muted",
    error: "border-danger bg-danger-ground text-danger",
    success: "border-success bg-success-ground text-success",
  } as const;

  const isBusy = kind === "loading";

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-busy={isBusy || undefined}
      className={`flex flex-col items-start gap-3 rounded-md border px-4 py-3 text-sm ${styles[kind]}`}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}
