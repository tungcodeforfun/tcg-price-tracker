import type { Alert } from "@tcg/core";
import { Field, inputClass, type FieldErrors } from "~/components/portfolio-form";
import { formatDate, formatPrice } from "~/lib/format";

/** "Below $40.00" / "Above $60.00". */
export function describeRule(alert: Pick<Alert, "direction" | "thresholdCents">): string {
  return `${alert.direction === "below" ? "Below" : "Above"} ${formatPrice(alert.thresholdCents)}`;
}

export function describeLastTriggered(
  alert: Pick<Alert, "lastTriggeredAt" | "lastTriggeredPriceCents">,
): string | null {
  if (!alert.lastTriggeredAt) return null;
  const date = formatDate(alert.lastTriggeredAt);
  return alert.lastTriggeredPriceCents === null
    ? date
    : `${date} at ${formatPrice(alert.lastTriggeredPriceCents)}`;
}

export function describeStatus(alert: Alert): string {
  if (!alert.active) return "Paused";
  const lastTriggered = describeLastTriggered(alert);
  if (lastTriggered) return `Last triggered ${lastTriggered}`;
  if (alert.conditionMet) return "Condition met, you'll be notified after the next price update";
  return "Watching";
}

/** Direction and threshold (dollars), posted as parsed by `parseAlertForm`. */
export function AlertFields({
  values,
  errors = {},
}: {
  values: { direction: string; threshold: string };
  errors?: FieldErrors;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium">Alert me when</span>
        <select
          name="direction"
          defaultValue={values.direction}
          aria-invalid={errors.direction ? true : undefined}
          className={inputClass}
        >
          <option value="below">Price drops to or below</option>
          <option value="above">Price rises to or above</option>
        </select>
        {errors.direction && (
          <span className="mt-1 block text-sm text-red-700 dark:text-red-400">
            {errors.direction}
          </span>
        )}
      </label>
      <Field
        label="Target price ($)"
        name="threshold"
        inputMode="decimal"
        required
        defaultValue={values.threshold}
        error={errors.thresholdCents}
      />
    </div>
  );
}
