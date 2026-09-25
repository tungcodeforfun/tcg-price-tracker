import {
  addLot,
  getVariantOption,
  listCardVariantOptions,
  ValidationError,
} from "~/.server/catalog";
import { Form, redirect } from "react-router";
import { db } from "~/.server/db";
import { formFailure, parseLotForm } from "~/.server/portfolio-form";
import { requireSession } from "~/.server/session";
import { LotFields, SubmitButton } from "~/components/portfolio-form";
import { Price } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { shortName, symbolFor } from "~/components/terminal/labels";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { formString } from "~/lib/form";
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
    <PageBody>
      <Breadcrumbs
        items={[
          { label: "Collection", to: "/app/collection" },
          { label: shortName(cardName), to: `/cards/${cardSlug}` },
          { label: "Add" },
        ]}
      />
      <PageHeader
        eyebrow="ACCT ▸ Collection"
        title="Add to collection"
        meta={[symbolFor({ setName, number: cardNumber }), setName].join(" · ")}
        className="max-w-3xl"
      />
      <Panel code="F1" title={`New lot · ${cardName}`} className="max-w-3xl border border-grid">
        <Form method="post" className="space-y-5 p-3 sm:p-4">
          {actionData?.formError && <FormMessage tone="error">{actionData.formError}</FormMessage>}
          <fieldset aria-describedby={errors.variant ? "variant-error" : undefined}>
            <legend className="micro mb-1.5 text-text">Printing and condition</legend>
            {errors.variant && (
              <p id="variant-error" className="mb-1.5 text-[11.5px] text-down">
                <span aria-hidden>✕ </span>
                {errors.variant}
              </p>
            )}
            <div className="divide-y divide-grid border border-wire bg-void">
              {options.map((o) => (
                <label
                  key={o.variantId}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[12.5px] hover:bg-rail has-[:checked]:bg-amber/10 has-[:checked]:shadow-[inset_2px_0_0_var(--color-amber)]"
                >
                  <input
                    type="radio"
                    name="variant"
                    value={o.variantId}
                    defaultChecked={o.variantId === checkedId}
                    required
                  />
                  <span className="min-w-0 flex-1">
                    {o.printing} · {o.condition}
                    {o.language !== "English" && <span className="text-mute"> ({o.language})</span>}
                  </span>
                  <Price cents={o.priceCents} className="text-mute" />
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
      </Panel>
    </PageBody>
  );
}
