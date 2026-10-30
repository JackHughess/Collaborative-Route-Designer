"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string;
  onCommit: (value: string) => void;
};

/**
 * Text input that writes to the document on blur or Enter, not every keystroke.
 * While unfocused it follows the shared value, so remote edits show up.
 */
export function CommitInput({
  value,
  onCommit,
  onBlur,
  onKeyDown,
  ...rest
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };

  return (
    <input
      {...rest}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
}

type AreaProps = {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
};

export function CommitTextarea({ value, onCommit, ...rest }: AreaProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <textarea
      {...rest}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
    />
  );
}
