export type FieldErrors = Partial<Record<string, string>>;

/** Action data returned by `formFailure` in `~/.server/portfolio-form`. */
export interface FormFailure {
  intent: string;
  errors: FieldErrors;
  formError?: string;
  values: Record<string, string>;
}

export function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
