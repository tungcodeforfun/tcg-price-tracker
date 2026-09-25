import type { ReactNode } from "react";
import { Form, useNavigation } from "react-router";

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">{footer}</div>}
    </div>
  );
}

export function AuthForm({ children }: { children: ReactNode }) {
  return (
    <Form method="post" className="space-y-4">
      {children}
    </Form>
  );
}

export function TextField(props: {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  minLength?: number;
}) {
  const { label, type = "text", ...input } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        required
        {...input}
        className="mt-1 block w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 dark:border-gray-700 dark:focus:border-gray-100 dark:focus:ring-gray-100"
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const busy = useNavigation().state === "submitting";
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </p>
  );
}

export function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
