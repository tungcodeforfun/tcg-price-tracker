import { useId } from "react";

export type FieldErrors = Partial<Record<string, string>>;

/** Action data returned by `formFailure` in `~/.server/portfolio-form`. */
export interface FormFailure {
  intent: string;
  errors: FieldErrors;
  formError?: string;
  values: Record<string, string>;
}

export const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 aria-[invalid]:border-red-500 dark:border-gray-700 dark:focus:border-gray-100 dark:focus:ring-gray-100";

export function Field(props: {
  label: string;
  name: string;
  type?: "text" | "number" | "date";
  inputMode?: "decimal" | "numeric";
  defaultValue?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  const { label, error, hint, type = "text", ...input } = props;
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
      />
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-sm text-red-700 dark:text-red-400">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="mt-1 block text-xs text-gray-500">
            {hint}
          </span>
        )
      )}
    </label>
  );
}

export function NotesField({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Notes</span>
      <textarea
        name="notes"
        rows={2}
        maxLength={500}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={inputClass}
      />
      {error && <span className="mt-1 block text-sm text-red-700 dark:text-red-400">{error}</span>}
    </label>
  );
}

/** Quantity, unit cost (dollars), acquired date and notes, posted as parsed by `parseLotForm`. */
export function LotFields({
  values,
  errors = {},
}: {
  values: { quantity: string; unitCost: string; acquiredOn: string; notes: string };
  errors?: FieldErrors;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Quantity"
          name="quantity"
          type="number"
          min={1}
          required
          defaultValue={values.quantity}
          error={errors.quantity}
        />
        <Field
          label="Unit cost ($)"
          name="unitCost"
          inputMode="decimal"
          defaultValue={values.unitCost}
          error={errors.unitCostCents}
          hint="What you paid per card. Leave blank if unknown."
        />
        <Field
          label="Acquired"
          name="acquiredOn"
          type="date"
          defaultValue={values.acquiredOn}
          error={errors.acquiredOn}
        />
      </div>
      <NotesField defaultValue={values.notes} error={errors.notes} />
    </>
  );
}
