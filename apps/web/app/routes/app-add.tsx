import {
  addLot,
  getVariantOption,
  listCardVariantOptions,
  ValidationError,
} from "~/.server/catalog";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { formFailure, parseLotForm } from "~/.server/portfolio-form";
import { requireSession } from "~/.server/session";
import { FormMessage, SubmitButton, formString } from "~/components/auth-form";
import { LotFields } from "~/components/portfolio-form";
import { formatPrice } from "~/lib/format";
import { notFound } from "~/lib/http";
import type { Route } from "./+types/app-add";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `Add ${loaderData.cardName} · TCG Price Tracker`
      : "Add to collection · TCG Price Tracker",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request);
  const url = new URL(request.url);
  const options = await listCardVariantOptions(db, url.searchParams.get("card") ?? "");
  const first = options[0];
  if (!first) throw notFound();
  const requested = options.find((o) => o.variantId === url.searchParams.get("variant"));
  const selectedId = requested?.variantId ?? (options.length === 1 ? first.variantId : "");
  return {
    cardSlug: first.cardSlug,
    cardName: first.cardName,
    cardNumber: first.cardNumber,
    setName: first.setName,
    options,
    selectedId,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  const variant = await getVariantOption(db, formString(form, "variant"));
  const lot = parseLotForm(form);
  if (!variant || !lot.ok) {
    const errors = lot.ok ? {} : lot.errors;
    if (!variant) errors.variant = "Choose a printing and condition";
    return formFailure(form, errors);
  }
  try {
    await addLot(db, user.id, variant.variantId, lot.input);
  } catch (error) {
    if (error instanceof ValidationError) return formFailure(form, {}, error.message);
    throw error;
  }
  return redirect("/app/collection");
}

export default function AddToCollection({ loaderData, actionData }: Route.ComponentProps) {
  const { cardSlug, cardName, cardNumber, setName, options, selectedId } = loaderData;
  const values = actionData?.values ?? {};
  const errors = actionData?.errors ?? {};
  const checkedId = values.variant ?? selectedId;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add to collection</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        <Link to={`/cards/${cardSlug}`} className="underline">
          {cardName}
        </Link>{" "}
        · {[setName, cardNumber].filter(Boolean).join(" · ")}
      </p>

      <Form method="post" className="mt-6 space-y-6">
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
        <LotFields
          values={{
            quantity: values.quantity ?? "1",
            unitCost: values.unitCost ?? "",
            acquiredOn: values.acquiredOn ?? "",
            notes: values.notes ?? "",
          }}
          errors={errors}
        />
        <SubmitButton>Add to collection</SubmitButton>
      </Form>
    </div>
  );
}
