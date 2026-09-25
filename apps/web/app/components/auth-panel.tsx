import type { ReactNode } from "react";
import { Link, useNavigation, type LinkProps } from "react-router";
import { Button } from "~/components/terminal/button";
import { Panel } from "~/components/terminal/panel";

export interface AuthPanelProps {
  /** Header rail label, e.g. "Credentials". */
  section: string;
  /** The page's `<h1>`. */
  title: string;
  children: ReactNode;
  /** Secondary links under the panel body. */
  footer?: ReactNode;
}

/** The centred panel every auth page renders into. */
export function AuthPanel({ section, title, children, footer }: AuthPanelProps) {
  return (
    <Panel code="AUTH" title={section} className="w-full max-w-sm border border-grid">
      <div className="p-4 sm:p-5">
        <h1 className="mb-5 font-sans text-[24px] leading-tight font-semibold tracking-[-0.02em] text-balance">
          {title}
        </h1>
        {children}
      </div>
      {footer && (
        <div className="border-t border-grid bg-rail px-4 py-3 text-[12px] text-mute sm:px-5">
          {footer}
        </div>
      )}
    </Panel>
  );
}

/** Inline text link for the secondary actions around the auth forms. */
export function AuthLink({ className = "", ...props }: LinkProps) {
  return (
    <Link
      className={`text-text underline decoration-wire underline-offset-4 hover:decoration-amber ${className}`}
      {...props}
    />
  );
}

/** Full-width primary submit that reports the pending submission. */
export function AuthSubmit({ children }: { children: ReactNode }) {
  const busy = useNavigation().state === "submitting";
  return (
    <Button type="submit" disabled={busy} className="w-full">
      {busy ? "Please wait…" : children}
    </Button>
  );
}
