import {
  deleteLot,
  formatDollars,
  getHolding,
  InsufficientQuantityError,
  sellFromLot,
  updateLot,
  ValidationError,
} from "~/.server/catalog";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { formFailure, parseLotForm, parseSaleForm } from "~/.server/portfolio-form";
import { requireSession } from "~/.server/session";
import { LotFields, SubmitButton } from "~/components/portfolio-form";
import { Delta, Price, Stat, StatGrid } from "~/components/terminal/figures";
import { Field, FormMessage, Textarea, TextInput } from "~/components/terminal/form";
import { shortName, symbolFor } from "~/components/terminal/labels";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { formString, type FormFailure } from "~/lib/form";
import { todayIsoDate } from "~/lib/format";
import { notFound } from "~/lib/http";
import type { Route } from "./+types/app-item";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `${loaderData.holding.cardName} · Collection · TCG Price Tracker`
      : "Collection · TCG Price Tracker",
  },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  const holding = await getHolding(db, user.id, params.itemId);
  if (!holding) throw notFound();
  return {
    holding,
    lotValues: {
      quantity: String(holding.quantity),
      unitCost: holding.unitCostCents === null ? "" : formatDollars(holding.unitCostCents),
      acquiredOn: holding.acquiredOn ?? "",
      notes: holding.notes ?? "",
    },
    today: todayIsoDate(),
  };
}

async function update(form: FormData, userId: string, itemId: string) {
  const lot = parseLotForm(form);
  if (!lot.ok) return formFailure(form, lot.errors);
  if (!(await updateLot(db, userId, itemId, lot.input))) throw notFound();
  return redirect("/app/collection");
}

async function sell(form: FormData, userId: string, itemId: string) {
  const sale = parseSaleForm(form);
  if (!sale.ok) return formFailure(form, sale.errors);
  try {
    if (!(await sellFromLot(db, userId, itemId, sale.input))) throw notFound();
  } catch (error) {
    if (!(error instanceof InsufficientQuantityError)) throw error;
    const available = `Only ${error.available} ${error.available === 1 ? "card is" : "cards are"} in this lot.`;
    return formFailure(form, { quantity: available });
  }
  const remaining = await getHolding(db, userId, itemId);
  return redirect(remaining ? `/app/items/${itemId}` : "/app/collection");
}

async function remove(userId: string, itemId: string) {
  if (!(await deleteLot(db, userId, itemId))) throw notFound();
  return redirect("/app/collection");
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  const intent = formString(form, "intent");
  try {
    if (intent === "update") return await update(form, user.id, params.itemId);
    if (intent === "sell") return await sell(form, user.id, params.itemId);
    if (intent === "delete") return await remove(user.id, params.itemId);
  } catch (error) {
    if (error instanceof ValidationError) return formFailure(form, {}, error.message);
    throw error;
  }
  return formFailure(form, {}, "Unknown action");
}

export default function CollectionItem({ loaderData, actionData }: Route.ComponentProps) {
  const { holding, lotValues, today } = loaderData;
  const failure = (intent: string): FormFailure | undefined =>
    actionData?.intent === intent ? actionData : undefined;
  const edit = failure("update");
  const sale = failure("sell");
  const other = failure("delete") ?? failure("");
  const variant = `${holding.printing} · ${holding.condition}${holding.language === "English" ? "" : ` (${holding.language})`}`;

  return (
    <PageBody>
      <Breadcrumbs
        items={[
          { label: "Collection", to: "/app/collection" },
          { label: shortName(holding.cardName) },
        ]}
      />
      <PageHeader
        eyebrow={`ACCT ▸ Collection ▸ ${symbolFor({ setName: holding.setName, number: holding.cardNumber })}`}
        title={
          <Link to={`/cards/${holding.cardSlug}`} className="hover:text-amber">
            {holding.cardName}
          </Link>
        }
        meta={`${holding.setName} · ${variant}`}
      />
      {other?.formError && (
        <FormMessage tone="error" className="mb-3">
          {other.formError}
        </FormMessage>
      )}

      <PanelGrid className="lg:grid-cols-12">
        <Panel code="F1" title="Lot" className="lg:col-span-12">
          <StatGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Quantity">{holding.quantity}</Stat>
            <Stat label="Unit cost">
              <Price cents={holding.unitCostCents} />
            </Stat>
            <Stat label="Market price">
              <Price cents={holding.priceCents} />
            </Stat>
            <Stat label={`Value (${holding.quantity})`}>
              <Price cents={holding.valueCents} />
            </Stat>
            <Stat label="Unrealized P&L">
              <Price cents={holding.unrealizedCents} signed />
            </Stat>
            <Stat label="Chg 7D">
              <Delta pct={holding.priceChange7dPct} />
            </Stat>
          </StatGrid>
        </Panel>

        <Panel code="F2" title="Edit lot" className="lg:col-span-6">
          <Form method="post" className="space-y-4 p-3 sm:p-4">
            <input type="hidden" name="intent" value="update" />
            {edit?.formError && <FormMessage tone="error">{edit.formError}</FormMessage>}
            <LotFields
              values={edit ? { ...lotValues, ...edit.values } : lotValues}
              errors={edit?.errors}
            />
            <SubmitButton>Save changes</SubmitButton>
          </Form>
        </Panel>

        <Panel code="F3" title="Record a sale" className="lg:col-span-6">
          <Form method="post" className="space-y-4 p-3 sm:p-4">
            <input type="hidden" name="intent" value="sell" />
            <p className="text-[12.5px] text-mute">
              Selling all {holding.quantity} removes this lot from your collection.
            </p>
            {sale?.formError && <FormMessage tone="error">{sale.formError}</FormMessage>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity" error={sale?.errors.quantity}>
                <TextInput
                  name="quantity"
                  type="number"
                  min={1}
                  max={holding.quantity}
                  required
                  defaultValue={sale?.values.quantity ?? String(holding.quantity)}
                />
              </Field>
              <Field label="Sale price per card ($)" error={sale?.errors.unitPriceCents}>
                <TextInput
                  name="unitPrice"
                  inputMode="decimal"
                  required
                  defaultValue={sale?.values.unitPrice}
                />
              </Field>
              <Field
                label="Fees ($)"
                error={sale?.errors.feesCents}
                hint="Total for this sale: platform, payment and shipping costs."
              >
                <TextInput name="fees" inputMode="decimal" defaultValue={sale?.values.fees} />
              </Field>
              <Field label="Sold on" error={sale?.errors.soldOn}>
                <TextInput
                  name="soldOn"
                  type="date"
                  required
                  defaultValue={sale?.values.soldOn ?? today}
                />
              </Field>
            </div>
            <Field label="Notes" error={sale?.errors.notes}>
              <Textarea name="notes" rows={2} maxLength={500} defaultValue={sale?.values.notes} />
            </Field>
            <SubmitButton variant="secondary">Record sale</SubmitButton>
          </Form>
        </Panel>

        <Panel code="F4" title="Delete lot" className="lg:col-span-12">
          <Form
            method="post"
            className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"
            onSubmit={(event) => {
              if (!confirm(`Delete ${holding.cardName} from your collection?`))
                event.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <p className="text-[12.5px] text-mute">
              Removes it without recording a sale. Use this for mistakes, not for cards you sold.
            </p>
            <SubmitButton variant="danger">Delete lot</SubmitButton>
          </Form>
        </Panel>
      </PanelGrid>
    </PageBody>
  );
}
