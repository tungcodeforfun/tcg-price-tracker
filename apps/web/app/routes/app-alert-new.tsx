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
import { AlertFields } from "~/components/alert-form";
import { Button } from "~/components/terminal/button";
import { DataTable, Th } from "~/components/terminal/data-table";
import { Price } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { formString } from "~/lib/form";
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
    <PageBody>
      <Breadcrumbs items={[{ label: "Alerts", to: "/app/alerts" }, { label: "New alert" }]} />
      <PageHeader
        eyebrow="ACCT ▸ Alerts ▸ New"
        title="Set price alert"
        meta={
          <>
            <Link to={`/cards/${cardSlug}`} className="text-text hover:text-amber">
              {cardName}
            </Link>{" "}
            · {[setName, cardNumber].filter(Boolean).join(" · ")}
          </>
        }
      />
      <Form
        method="post"
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
        {actionData?.formError && (
          <FormMessage tone="error" className="mb-3">
            {actionData.formError}
          </FormMessage>
        )}
        <PanelGrid className="lg:grid-cols-12">
          <Panel
            title="Printing × condition"
            meta={`${options.length} ${options.length === 1 ? "quote" : "quotes"}`}
            className="lg:col-span-7"
          >
            <fieldset aria-describedby={errors.variant ? "variant-error" : undefined}>
              <legend className="sr-only">Printing and condition</legend>
              {errors.variant && (
                <p id="variant-error" className="px-3 pt-2 text-[11.5px] text-down">
                  <span aria-hidden>✕ </span>
                  {errors.variant}
                </p>
              )}
              <DataTable>
                <thead>
                  <tr>
                    <Th className="w-8">
                      <span className="sr-only">Selected</span>
                    </Th>
                    <Th>Printing</Th>
                    <Th>Condition</Th>
                    <Th className="hidden sm:table-cell">Lang</Th>
                    <Th numeric>Last</Th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => {
                    const id = `variant-${o.variantId}`;
                    return (
                      <tr
                        key={o.variantId}
                        className="has-checked:bg-amber/8 has-checked:shadow-[inset_2px_0_0_var(--color-amber)]"
                      >
                        <td>
                          <input
                            id={id}
                            type="radio"
                            name="variant"
                            value={o.variantId}
                            defaultChecked={o.variantId === checkedId}
                            required
                            className="relative z-10 block"
                          />
                        </td>
                        <td>
                          <label
                            htmlFor={id}
                            className="cursor-pointer font-medium after:absolute after:inset-0"
                          >
                            {o.printing}
                            <span className="sr-only">
                              {" "}
                              · {o.condition}
                              {o.language !== "English" && ` · ${o.language}`}
                            </span>
                          </label>
                        </td>
                        <td className="text-mute">{o.condition}</td>
                        <td className="hidden text-mute sm:table-cell">
                          {o.language === "English" ? "EN" : o.language}
                        </td>
                        <td className="text-right">
                          <Price cents={o.priceCents} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </fieldset>
          </Panel>
          <Panel title="Rule" className="lg:col-span-5">
            <div className="space-y-4 p-3 sm:p-4">
              <AlertFields
                values={{
                  direction: values.direction ?? "below",
                  threshold: values.threshold ?? prices.get(checkedId) ?? "",
                }}
                errors={errors}
              />
              <Button type="submit">Create alert</Button>
            </div>
          </Panel>
        </PanelGrid>
      </Form>
    </PageBody>
  );
}
