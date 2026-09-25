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
import { FormMessage, SubmitButton, formString } from "~/components/auth-form";
import { Field, LotFields, NotesField, type FormFailure } from "~/components/portfolio-form";
import { Pnl } from "~/components/pnl";
import { formatPrice, todayIsoDate } from "~/lib/format";
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

const sectionClass = "rounded-lg border border-gray-200 p-5 dark:border-gray-800";

export default function CollectionItem({ loaderData, actionData }: Route.ComponentProps) {
  const { holding, lotValues, today } = loaderData;
  const failure = (intent: string): FormFailure | undefined =>
    actionData?.intent === intent ? actionData : undefined;
  const edit = failure("update");
  const sale = failure("sell");
  const other = failure("delete") ?? failure("");

  return (
    <div className="max-w-2xl">
      <p className="text-sm">
        <Link to="/app/collection" className="text-gray-500 hover:underline">
          ← Collection
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        <Link to={`/cards/${holding.cardSlug}`} className="hover:underline">
          {holding.cardName}
        </Link>
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {[holding.setName, holding.cardNumber, holding.printing, holding.condition]
          .filter(Boolean)
          .join(" · ")}
        {holding.language !== "English" && ` (${holding.language})`}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Market price</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatPrice(holding.priceCents)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Value ({holding.quantity})</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatPrice(holding.valueCents)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Unrealized P&L</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Pnl cents={holding.unrealizedCents} />
          </dd>
        </div>
      </dl>
      {other?.formError && (
        <div className="mt-4">
          <FormMessage tone="error">{other.formError}</FormMessage>
        </div>
      )}

      <section className={`mt-8 ${sectionClass}`} aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-lg font-semibold">
          Edit lot
        </h2>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="update" />
          {edit?.formError && <FormMessage tone="error">{edit.formError}</FormMessage>}
          <LotFields
            values={edit ? { ...lotValues, ...edit.values } : lotValues}
            errors={edit?.errors}
          />
          <SubmitButton>Save changes</SubmitButton>
        </Form>
      </section>

      <section className={`mt-6 ${sectionClass}`} aria-labelledby="sell-heading">
        <h2 id="sell-heading" className="text-lg font-semibold">
          Record a sale
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Selling all {holding.quantity} removes this lot from your collection.
        </p>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="sell" />
          {sale?.formError && <FormMessage tone="error">{sale.formError}</FormMessage>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quantity"
              name="quantity"
              type="number"
              min={1}
              max={holding.quantity}
              required
              defaultValue={sale?.values.quantity ?? String(holding.quantity)}
              error={sale?.errors.quantity}
            />
            <Field
              label="Sale price per card ($)"
              name="unitPrice"
              inputMode="decimal"
              required
              defaultValue={sale?.values.unitPrice}
              error={sale?.errors.unitPriceCents}
            />
            <Field
              label="Fees ($)"
              name="fees"
              inputMode="decimal"
              defaultValue={sale?.values.fees}
              error={sale?.errors.feesCents}
              hint="Total for this sale: platform, payment and shipping costs."
            />
            <Field
              label="Sold on"
              name="soldOn"
              type="date"
              required
              defaultValue={sale?.values.soldOn ?? today}
              error={sale?.errors.soldOn}
            />
          </div>
          <NotesField defaultValue={sale?.values.notes} error={sale?.errors.notes} />
          <SubmitButton>Record sale</SubmitButton>
        </Form>
      </section>

      <section className={`mt-6 ${sectionClass}`} aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-lg font-semibold">
          Delete lot
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Removes it without recording a sale. Use this for mistakes, not for cards you sold.
        </p>
        <Form
          method="post"
          className="mt-4"
          onSubmit={(event) => {
            if (!confirm(`Delete ${holding.cardName} from your collection?`))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete lot
          </button>
        </Form>
      </section>
    </div>
  );
}
