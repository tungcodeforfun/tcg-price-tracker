import { data } from "react-router";
import { formString, type FieldErrors } from "~/lib/form";
import {
  isValidDate,
  parseDollars,
  type AlertDirection,
  type AlertInput,
  type LotInput,
  type SaleInput,
} from "./catalog.ts";

type Field<T> = { value: T } | { error: string };
type Parsed<T> = { ok: true; input: T } | { ok: false; errors: FieldErrors };

function quantity(raw: string): Field<number> {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) return { error: "Enter a whole number of 1 or more" };
  return { value: Number(raw) };
}

function dollars(raw: string): Field<number | null> {
  const parsed = parseDollars(raw);
  return parsed.ok ? { value: parsed.cents } : { error: parsed.message };
}

function requiredDollars(raw: string): Field<number> {
  const field = dollars(raw);
  if ("error" in field) return field;
  return field.value === null ? { error: "Enter an amount" } : { value: field.value };
}

function day(raw: string): Field<string | null> {
  if (raw === "") return { value: null };
  return isValidDate(raw) ? { value: raw } : { error: "Enter a date as YYYY-MM-DD" };
}

function requiredDay(raw: string): Field<string> {
  const field = day(raw);
  if ("error" in field) return field;
  return field.value === null ? { error: "Enter a date" } : { value: field.value };
}

function collect<T extends object>(fields: { [K in keyof T]: Field<T[K]> }): Parsed<T> {
  const errors: FieldErrors = {};
  const input: Partial<T> = {};
  for (const key of Object.keys(fields) as (keyof T & string)[]) {
    const field = fields[key];
    if ("error" in field) errors[key] = field.error;
    else input[key] = field.value;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input: input as T };
}

/** Field errors are keyed by `LotInput` property; the form posts `unitCost` in dollars. */
export function parseLotForm(form: FormData): Parsed<LotInput> {
  return collect<LotInput>({
    quantity: quantity(formString(form, "quantity")),
    unitCostCents: dollars(formString(form, "unitCost")),
    acquiredOn: day(formString(form, "acquiredOn")),
    notes: { value: formString(form, "notes") || null },
  });
}

/** Field errors are keyed by `SaleInput` property; the form posts `unitPrice` and `fees` in dollars. */
export function parseSaleForm(form: FormData): Parsed<SaleInput> {
  const fees = dollars(formString(form, "fees"));
  return collect<SaleInput>({
    quantity: quantity(formString(form, "quantity")),
    unitPriceCents: requiredDollars(formString(form, "unitPrice")),
    feesCents: "error" in fees ? fees : { value: fees.value ?? 0 },
    soldOn: requiredDay(formString(form, "soldOn")),
    notes: { value: formString(form, "notes") || null },
  });
}

function direction(raw: string): Field<AlertDirection> {
  return raw === "below" || raw === "above"
    ? { value: raw }
    : { error: "Choose when to alert you" };
}

function threshold(raw: string): Field<number> {
  const field = requiredDollars(raw);
  if ("error" in field || field.value > 0) return field;
  return { error: "Enter an amount above $0.00" };
}

/** Field errors are keyed by `AlertInput` property; the form posts `threshold` in dollars. */
export function parseAlertForm(form: FormData): Parsed<AlertInput> {
  return collect<AlertInput>({
    direction: direction(formString(form, "direction")),
    thresholdCents: threshold(formString(form, "threshold")),
  });
}

/** A 400 response that re-renders the submitted form with its values and errors. */
export function formFailure(form: FormData, errors: FieldErrors, formError?: string) {
  const values: Record<string, string> = {};
  for (const [name, value] of form) if (typeof value === "string") values[name] = value;
  return data({ intent: formString(form, "intent"), errors, formError, values }, { status: 400 });
}
