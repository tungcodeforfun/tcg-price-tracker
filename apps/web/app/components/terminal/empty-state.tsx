import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Short status line, e.g. "No sales recorded yet". */
  title: ReactNode;
  /** Optional explanation or next step. */
  children?: ReactNode;
  /** Optional call to action, e.g. a `ButtonLink`. */
  action?: ReactNode;
  className?: string;
}

/** Placeholder for an empty list, table or panel. Unboxed: sits inside a `Panel` or bordered area. */
export function EmptyState({ title, children, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`px-4 py-6 ${className}`}>
      <p className="micro text-text">
        <span aria-hidden className="mr-2 text-amber">
          ∅
        </span>
        {title}
      </p>
      {children && <div className="mt-2 max-w-prose text-[12.5px] text-mute">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
