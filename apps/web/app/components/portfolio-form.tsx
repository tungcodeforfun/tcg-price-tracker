import type { ReactNode } from "react";
import { useNavigation } from "react-router";
import { Button, type ButtonVariant } from "~/components/terminal/button";
import { Field, Textarea, TextInput } from "~/components/terminal/form";
import type { FieldErrors } from "~/lib/form";

/** A submit button that is disabled while any form on the page is submitting. */
export function SubmitButton({
  variant,
  children,
}: {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  const busy = useNavigation().state === "submitting";
  return (
    <Button type="submit" variant={variant} disabled={busy}>
      {busy ? "Please wait…" : children}
    </Button>
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
        <Field label="Quantity" error={errors.quantity}>
          <TextInput
            name="quantity"
            type="number"
            min={1}
            required
            defaultValue={values.quantity}
          />
        </Field>
        <Field
          label="Unit cost ($)"
          error={errors.unitCostCents}
          hint="What you paid per card. Leave blank if unknown."
        >
          <TextInput name="unitCost" inputMode="decimal" defaultValue={values.unitCost} />
        </Field>
        <Field label="Acquired" error={errors.acquiredOn}>
          <TextInput name="acquiredOn" type="date" defaultValue={values.acquiredOn} />
        </Field>
      </div>
      <Field label="Notes" error={errors.notes}>
        <Textarea name="notes" rows={2} maxLength={500} defaultValue={values.notes} />
      </Field>
    </>
  );
}
