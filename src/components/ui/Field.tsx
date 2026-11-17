"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from "react";

/**
 * A labelled text field.
 *
 * Client component because it derives its ids with `useId`, which is a hook and therefore
 * unavailable to a server component.
 *
 * Accessibility decisions that are not optional here:
 *   - the label is always rendered and always bound with htmlFor/id;
 *   - an error is announced through aria-describedby and marks the input aria-invalid;
 *   - `dir="auto"` on the control, so a Latin email typed into the Arabic interface is not
 *     reordered by the direction of the surrounding paragraph.
 */
export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
}

export function Field({ label, hint, error, trailing, className = "", ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        dir="auto"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          "min-h-11 w-full rounded-md border bg-ground-paper px-3 py-2 text-base text-ink " +
          "placeholder:text-ink-muted focus-visible:border-gold-deep " +
          (error ? "border-danger" : "border-line") +
          ` ${className}`.trim()
        }
        {...rest}
      />
      {trailing}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextareaField({ label, hint, error, rows = 4, className = "", ...rest }: TextareaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        dir="auto"
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          "w-full rounded-md border bg-ground-paper px-3 py-2 text-base text-ink " +
          (error ? "border-danger" : "border-line") +
          ` ${className}`.trim()
        }
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
