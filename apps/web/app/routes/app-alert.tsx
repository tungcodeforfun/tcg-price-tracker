import {
  deleteAlert,
  formatDollars,
  getAlert,
  setAlertActive,
  updateAlert,
  ValidationError,
} from "~/.server/catalog";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { formFailure, parseAlertForm } from "~/.server/portfolio-form";
import { requireSession } from "~/.server/session";
import { FormMessage, SubmitButton, formString } from "~/components/auth-form";
import {
  AlertFields,
  describeLastTriggered,
  describeRule,
  describeStatus,
} from "~/components/alert-form";
import type { FormFailure } from "~/components/portfolio-form";
import { formatPrice } from "~/lib/format";
import { notFound } from "~/lib/http";
import type { Route } from "./+types/app-alert";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `${loaderData.alert.cardName} · Price alerts · TCG Price Tracker`
      : "Price alerts · TCG Price Tracker",
  },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  const alert = await getAlert(db, user.id, params.alertId);
  if (!alert) throw notFound();
  return {
    alert,
    alertValues: { direction: alert.direction, threshold: formatDollars(alert.thresholdCents) },
  };
}

async function update(form: FormData, userId: string, alertId: string) {
  const alert = parseAlertForm(form);
  if (!alert.ok) return formFailure(form, alert.errors);
  if (!(await updateAlert(db, userId, alertId, alert.input))) throw notFound();
  return redirect("/app/alerts");
}

async function setActive(userId: string, alertId: string, active: boolean) {
  if (!(await setAlertActive(db, userId, alertId, active))) throw notFound();
  return redirect(`/app/alerts/${alertId}`);
}

async function remove(userId: string, alertId: string) {
  if (!(await deleteAlert(db, userId, alertId))) throw notFound();
  return redirect("/app/alerts");
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  const intent = formString(form, "intent");
  try {
    if (intent === "update") return await update(form, user.id, params.alertId);
    if (intent === "pause") return await setActive(user.id, params.alertId, false);
    if (intent === "resume") return await setActive(user.id, params.alertId, true);
    if (intent === "delete") return await remove(user.id, params.alertId);
  } catch (error) {
    if (error instanceof ValidationError) return formFailure(form, {}, error.message);
    throw error;
  }
  return formFailure(form, {}, "Unknown action");
}

const sectionClass = "rounded-lg border border-gray-200 p-5 dark:border-gray-800";
const secondaryButtonClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900";

export default function PriceAlert({ loaderData, actionData }: Route.ComponentProps) {
  const { alert, alertValues } = loaderData;
  const failure = (intent: string): FormFailure | undefined =>
    actionData?.intent === intent ? actionData : undefined;
  const edit = failure("update");
  const other = failure("pause") ?? failure("resume") ?? failure("delete") ?? failure("");

  return (
    <div className="max-w-2xl">
      <p className="text-sm">
        <Link to="/app/alerts" className="text-gray-500 hover:underline">
          ← Price alerts
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        <Link to={`/cards/${alert.cardSlug}`} className="hover:underline">
          {alert.cardName}
        </Link>
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {[alert.setName, alert.printing, alert.condition].join(" · ")}
        {alert.language !== "English" && ` (${alert.language})`}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Current price</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatPrice(alert.priceCents)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Rule</dt>
          <dd className="text-lg font-semibold tabular-nums">{describeRule(alert)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last triggered</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {describeLastTriggered(alert) ?? "Never"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm">
        <span className="text-gray-500">Status:</span> {describeStatus(alert)}
      </p>
      {other?.formError && (
        <div className="mt-4">
          <FormMessage tone="error">{other.formError}</FormMessage>
        </div>
      )}

      <section className={`mt-8 ${sectionClass}`} aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-lg font-semibold">
          Edit alert
        </h2>
        <p className="mt-1 text-sm text-gray-500">Saving re-arms the alert.</p>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="update" />
          {edit?.formError && <FormMessage tone="error">{edit.formError}</FormMessage>}
          <AlertFields
            values={edit ? { ...alertValues, ...edit.values } : alertValues}
            errors={edit?.errors}
          />
          <SubmitButton>Save changes</SubmitButton>
        </Form>
      </section>

      <section className={`mt-6 ${sectionClass}`} aria-labelledby="pause-heading">
        <h2 id="pause-heading" className="text-lg font-semibold">
          {alert.active ? "Pause alert" : "Resume alert"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {alert.active
            ? "A paused alert keeps its settings but sends no emails."
            : "This alert is paused and sends no emails until you resume it."}
        </p>
        <Form method="post" className="mt-4">
          <input type="hidden" name="intent" value={alert.active ? "pause" : "resume"} />
          <button type="submit" className={secondaryButtonClass}>
            {alert.active ? "Pause alert" : "Resume alert"}
          </button>
        </Form>
      </section>

      <section className={`mt-6 ${sectionClass}`} aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-lg font-semibold">
          Delete alert
        </h2>
        <Form
          method="post"
          className="mt-4"
          onSubmit={(event) => {
            if (!confirm(`Delete the price alert for ${alert.cardName}?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete alert
          </button>
        </Form>
      </section>
    </div>
  );
}
