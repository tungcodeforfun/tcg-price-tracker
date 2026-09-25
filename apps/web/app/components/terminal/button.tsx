import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-amber font-bold text-void hover:brightness-110",
  secondary: "border border-wire text-text hover:border-amber hover:text-amber",
  danger: "border border-down/60 text-down hover:bg-down hover:text-void",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-[10.5px]",
  md: "h-9 gap-2 px-3.5 text-[11.5px]",
};

export interface ButtonStyle {
  /** `primary`: amber fill, the one main action. `secondary`: outline. `danger`: destructive. */
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Button classes, for elements that can't be `Button`/`ButtonLink` (e.g. a plain `<a download>`). */
export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}): string {
  return `inline-flex shrink-0 items-center justify-center tracking-[0.12em] whitespace-nowrap uppercase disabled:pointer-events-none disabled:opacity-50 ${SIZE[size]} ${VARIANT[variant]}`;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle;

/** A `<button>`. Like the native element it submits its form unless `type="button"`. */
export function Button({ variant, size, className = "", ...props }: ButtonProps) {
  return <button className={`${buttonClass({ variant, size })} ${className}`} {...props} />;
}

export type ButtonLinkProps = LinkProps & ButtonStyle;

/** A router `Link` that looks like a button. */
export function ButtonLink({ variant, size, className = "", ...props }: ButtonLinkProps) {
  return <Link className={`${buttonClass({ variant, size })} ${className}`} {...props} />;
}
