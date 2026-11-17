import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-body font-medium transition-colors " +
  "rounded-md disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Obsidian on ivory measures 15.39:1 — the strongest pairing in the palette.
  primary: "bg-ground-dark text-ink-inverse hover:bg-brand-emerald-deep",
  secondary:
    "border border-line bg-ground-paper text-ink hover:border-gold-deep hover:text-gold-deep",
  quiet: "text-ink-muted hover:text-ink",
  danger: "bg-danger text-ink-inverse hover:bg-danger",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-7 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...rest}
    />
  );
}

/** Renders an anchor with button styling — for navigation, where a button would be wrong. */
export function buttonClass(variant: Variant = "primary", size: Size = "md"): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
