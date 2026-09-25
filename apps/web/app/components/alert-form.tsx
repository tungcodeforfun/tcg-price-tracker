import type { Alert } from "@tcg/core";
import type { ReactNode } from "react";
import { Delta, Price } from "~/components/terminal/figures";
import { Field, Select, TextInput } from "~/components/terminal/form";
import { type FieldErrors } from "~/lib/form";
import { formatDate, formatPrice, formatShortDate } from "~/lib/format";

function Tag({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`micro inline-block border px-1.5 ${className}`}>{children}</span>;
}

/** "≤ $40.00 BELOW" / "≥ $60.00 ABOVE"; `tagClassName` places the decorative direction tag. */
export function AlertRule({
  alert,
  tagClassName = "",
}: {
  alert: Pick<Alert, "direction" | "thresholdCents">;
  tagClassName?: string;
}) {
  const below = alert.direction === "below";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span>
        <span aria-hidden>{below ? "≤" : "≥"} </span>
        <span className="sr-only">{below ? "At or below " : "At or above "}</span>
        {formatPrice(alert.thresholdCents)}
      </span>
      <span aria-hidden className={tagClassName}>
        <Tag className={`border-wire ${below ? "text-down" : "text-up"}`}>
          {below ? "Below" : "Above"}
        </Tag>
      </span>
    </span>
  );
}

/** "Sep 20, 2026 @ $39.00", or null if the alert never fired. */
export function describeLastTriggered(
  alert: Pick<Alert, "lastTriggeredAt" | "lastTriggeredPriceCents">,
): string | null {
  if (!alert.lastTriggeredAt) return null;
  const date = formatDate(alert.lastTriggeredAt);
  return alert.lastTriggeredPriceCents === null
    ? date
    : `${date} @ ${formatPrice(alert.lastTriggeredPriceCents)}`;
}

/** Paused, triggered (with when and at what price), condition met, or watching. */
export function AlertStatus({ alert }: { alert: Alert }) {
  if (!alert.active) return <Tag className="border-grid text-mute">Paused</Tag>;
  if (alert.lastTriggeredAt) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Tag className="border-up/60 text-up">Triggered</Tag>
        <span className="whitespace-nowrap">
          {formatShortDate(alert.lastTriggeredAt)}
          {alert.lastTriggeredPriceCents !== null &&
            ` @ ${formatPrice(alert.lastTriggeredPriceCents)}`}
        </span>
      </span>
    );
  }
  if (alert.conditionMet) {
    return (
      <Tag className="border-amber text-amber">
        Met<span className="sr-only">, you'll be notified after the next price update</span>
      </Tag>
    );
  }
  return <Tag className="border-wire text-text">Watching</Tag>;
}

/** The price move still needed to reach the target; "In range" once the condition holds. */
export function DistanceToTarget({ alert }: { alert: Alert }) {
  if (alert.priceCents === null || alert.priceCents === 0) return <Price cents={null} />;
  if (alert.conditionMet) return <span className="text-amber">In range</span>;
  return <Delta pct={((alert.thresholdCents - alert.priceCents) / alert.priceCents) * 100} />;
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
      <Field label="Alert me when" error={errors.direction}>
        <Select name="direction" defaultValue={values.direction}>
          <option value="below">≤ Price drops to or below</option>
          <option value="above">≥ Price rises to or above</option>
        </Select>
      </Field>
      <Field label="Target price (USD)" error={errors.thresholdCents}>
        <TextInput
          name="threshold"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={values.threshold}
        />
      </Field>
    </div>
  );
}
