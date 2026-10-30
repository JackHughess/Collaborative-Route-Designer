"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation first. */
export function ConfirmSubmit({
  message,
  className,
  children,
  label,
}: {
  message: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
