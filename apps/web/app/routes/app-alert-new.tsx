import {
  createAlert,
  formatDollars,
  getVariantOption,
  listCardVariantOptions,
  ValidationError,
} from "~/.server/catalog";
import { useRef } from "react";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { formFailure, parseAlertForm } from "~/.server/portfolio-form";
import { requireSession } from "~/.server/session";
import { FormMessage, SubmitButton, formString } from "~/components/auth-form";
import { AlertFields } from "~/components/alert-form";
import { formatPrice } from "~/lib/format";
import { notFound } from "~/lib/http";
import type { Route } from "./+types/app-alert-new";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `Price alert for ${loaderData.cardName} · TCG Price Tracker`
      : "New price alert · TCG Price Tracker",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request);
  const url = new URL(request.url);
  const variants = await listCardVariantOptions(db, url.searchParams.get("card") ?? "");
  const first = variants[0];
  if (!first) throw notFound();
  const requested = variants.find((o) => o.variantId === url.searchParams.get("variant"));
  const selectedId = requested?.variantId ?? (variants.length === 1 ? first.variantId : "");
  return {
    cardSlug: first.cardSlug,
    cardName: first.cardName,
    cardNumber: first.cardNumber,
    setName: first.setName,
    options: variants.map((o) => ({
      ...o,
      priceDollars: o.priceCents === null ? "" : formatDollars(o.priceCents),
    })),
    selectedId,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  const variant = await getVariantOption(db, formString(form, "variant"));
  const alert = parseAlertForm(form);
  if (!variant || !alert.ok) {
    const errors = alert.ok ? {} : alert.errors;
    if (!variant) errors.variant = "Choose a printing and condition";
    return formFailure(form, errors);
  }
  try {
    await createAlert(db, user.id, variant.variantId, alert.input);
  } catch (error) {
    if (error instanceof ValidationError) return formFailure(form, {}, error.message);
    throw error;
  }
  return redirect("/app/alerts");
}

export default function NewAlert({ loaderData, actionData }: Route.ComponentProps) {
  const { cardSlug, cardName, cardNumber, setName, options, selectedId } = loaderData;
  const values = actionData?.values ?? {};
  const errors = actionData?.errors ?? {};
  const checkedId = values.variant ?? selectedId;
  const prices = new Map(options.map((o) => [o.variantId, o.priceDollars]));
  // Choosing a printing fills in its price until the user types their own target.
  const thresholdEdited = useRef(values.threshold !== undefined);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Set price alert</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        <Link to={`/cards/${cardSlug}`} className="underline">
          {cardName}
        </Link>{" "}
        · {[setName, cardNumber].filter(Boolean).join(" · ")}
      </p>

      <Form
        method="post"
        className="mt-6 space-y-6"
        onChange={(event) => {
          const target: EventTarget = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (target.name === "threshold") thresholdEdited.current = true;
          if (target.name !== "variant" || thresholdEdited.current) return;
          const price = prices.get(target.value);
          const threshold = event.currentTarget.elements.namedItem("threshold");
          if (price && threshold instanceof HTMLInputElement) threshold.value = price;
        }}
      >
        {actionData?.formError && <FormMessage tone="error">{actionData.formError}</FormMessage>}
        <fieldset aria-describedby={errors.variant ? "variant-error" : undefined}>
          <legend className="text-sm font-medium">Printing and condition</legend>
          {errors.variant && (
            <p id="variant-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
              {errors.variant}
            </p>
          )}
          <div className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {options.map((o) => (
              <label
                key={o.variantId}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm has-[:checked]:bg-gray-100 dark:has-[:checked]:bg-gray-900"
              >
                <input
                  type="radio"
                  name="variant"
                  value={o.variantId}
                  defaultChecked={o.variantId === checkedId}
                  required
                />
                <span className="flex-1">
                  {o.printing} · {o.condition}
                  {o.language !== "English" && (
                    <span className="text-gray-500"> ({o.language})</span>
                  )}
                </span>
                <span className="tabular-nums text-gray-600 dark:text-gray-400">
                  {formatPrice(o.priceCents)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <AlertFields
          values={{
            direction: values.direction ?? "below",
            threshold: values.threshold ?? prices.get(checkedId) ?? "",
          }}
          errors={errors}
        />
        <SubmitButton>Create alert</SubmitButton>
      </Form>
    </div>
  );
}
