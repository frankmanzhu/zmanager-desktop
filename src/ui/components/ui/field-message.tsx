import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

export type FieldMessageProps = Readonly<{
  id: string;
  error?: string | null;
  children?: ReactNode;
  className?: string;
}>;

/** Small, non-owning inline description/error seam for form controls. */
export function FieldMessage({
  id,
  error,
  children,
  className,
}: FieldMessageProps) {
  const message = error ?? children;
  return (
    <p
      id={id}
      className={cn(
        "text-xs leading-5",
        error
          ? "text-red-700 dark:text-red-300"
          : "text-slate-500 dark:text-slate-400",
        className,
      )}
      aria-live={error ? "polite" : undefined}
      hidden={!message}
    >
      {message}
    </p>
  );
}

export function fieldValidationProps(
  invalid: boolean,
  descriptionIds: readonly string[],
): { "aria-invalid"?: true; "aria-describedby": string } {
  return {
    ...(invalid ? { "aria-invalid": true as const } : {}),
    "aria-describedby": descriptionIds.join(" "),
  };
}
