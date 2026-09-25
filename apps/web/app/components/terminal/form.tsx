import {
  createContext,
  use,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

interface FieldWiring {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldWiring | null>(null);

export interface FieldProps {
  label: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Validation message; marks the control `aria-invalid`. */
  error?: string;
  className?: string;
  /** Exactly one `TextInput`, `Select` or `Textarea`; it is wired to the label, hint and error. */
  children: ReactNode;
}

/** A labelled form control with optional hint and error text. */
export function Field({ label, hint, error, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="micro mb-1.5 block text-text">
        {label}
      </label>
      <FieldContext value={{ id, describedBy, invalid: Boolean(error) }}>{children}</FieldContext>
      {hint && (
        <p id={hintId} className="mt-1.5 text-[11.5px] text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[11.5px] text-down">
          <span aria-hidden>✕ </span>
          {error}
        </p>
      )}
    </div>
  );
}

type Wiring = Pick<HTMLAttributes<HTMLElement>, "id" | "aria-describedby" | "aria-invalid">;

/** Props a control takes from its `Field`, unless set explicitly. */
function useFieldWiring(props: Wiring): Wiring {
  const field = use(FieldContext);
  return {
    id: props.id ?? field?.id,
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid || undefined),
  };
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** Any text-like `<input>` (text, email, password, number, date, search, file). */
export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input {...props} {...useFieldWiring(props)} className={`control ${className}`} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** A native `<select>`; pass `<option>` children. */
export function Select({ className = "", ...props }: SelectProps) {
  return <select {...props} {...useFieldWiring(props)} className={`control ${className}`} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return <textarea {...props} {...useFieldWiring(props)} className={`control ${className}`} />;
}

export type FormMessageTone = "error" | "success" | "info";

const MESSAGE: Record<FormMessageTone, { tag: string; className: string }> = {
  error: { tag: "ERR", className: "border-down text-down" },
  success: { tag: "OK", className: "border-up text-up" },
  info: { tag: "INFO", className: "border-amber text-amber" },
};

export interface FormMessageProps {
  /** `error` is announced assertively (`role="alert"`); the others politely (`role="status"`). */
  tone: FormMessageTone;
  children: ReactNode;
  className?: string;
}

/** Form-level feedback: a failed submit, a saved change, a note. */
export function FormMessage({ tone, children, className = "" }: FormMessageProps) {
  const { tag, className: toneClass } = MESSAGE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 border-l-2 bg-deck px-3 py-2 text-[12.5px] ${toneClass} ${className}`}
    >
      <span className="micro shrink-0 pt-px font-bold text-current">{tag}</span>
      <div className="min-w-0 text-text">{children}</div>
    </div>
  );
}
