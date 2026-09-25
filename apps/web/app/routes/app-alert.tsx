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
import {
  AlertFields,
  AlertRule,
  AlertStatus,
  describeLastTriggered,
  DistanceToTarget,
} from "~/components/alert-form";
import { Button } from "~/components/terminal/button";
import { Price, Stat, StatGrid } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { formString, type FormFailure } from "~/lib/form";
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

export default function PriceAlert({ loaderData, actionData }: Route.ComponentProps) {
  const { alert, alertValues } = loaderData;
  const failure = (intent: string): FormFailure | undefined =>
    actionData?.intent === intent ? actionData : undefined;
  const edit = failure("update");
  const other = failure("pause") ?? failure("resume") ?? failure("delete") ?? failure("");

  return (
    <PageBody>
      <Breadcrumbs items={[{ label: "Alerts", to: "/app/alerts" }, { label: alert.cardName }]} />
      <PageHeader
        eyebrow="ACCT ▸ Alerts"
        title={
          <Link to={`/cards/${alert.cardSlug}`} className="hover:text-amber">
            {alert.cardName}
          </Link>
        }
        meta={[
          alert.setName,
          alert.printing,
          alert.condition,
          alert.language !== "English" && alert.language,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      {other?.formError && (
        <FormMessage tone="error" className="mb-3">
          {other.formError}
        </FormMessage>
      )}

      <PanelGrid className="lg:grid-cols-12">
        <Panel title="Status" className="lg:col-span-12">
          <StatGrid className="grid-cols-2 lg:grid-cols-5">
            <Stat label="Last">
              <Price cents={alert.priceCents} />
            </Stat>
            <Stat label="Rule">
              <AlertRule alert={alert} />
            </Stat>
            <Stat label="To target">
              <DistanceToTarget alert={alert} />
            </Stat>
            <Stat label="Status">
              <AlertStatus alert={alert} />
            </Stat>
            <Stat label="Last triggered" className="col-span-2 lg:col-span-1">
              {describeLastTriggered(alert) ?? "Never"}
            </Stat>
          </StatGrid>
        </Panel>

        <Panel title="Edit rule" className="lg:col-span-8">
          <Form method="post" className="space-y-4 p-3 sm:p-4">
            <input type="hidden" name="intent" value="update" />
            {edit?.formError && <FormMessage tone="error">{edit.formError}</FormMessage>}
            <AlertFields
              values={edit ? { ...alertValues, ...edit.values } : alertValues}
              errors={edit?.errors}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Save changes</Button>
              <p className="text-[11.5px] text-mute">Saving re-arms the alert.</p>
            </div>
          </Form>
        </Panel>

        <Panel title="Manage" className="lg:col-span-4">
          <div className="divide-y divide-grid">
            <Form method="post" className="p-3 sm:p-4">
              <input type="hidden" name="intent" value={alert.active ? "pause" : "resume"} />
              <p className="text-[12.5px] text-mute">
                {alert.active
                  ? "A paused alert keeps its settings but sends no emails."
                  : "This alert is paused and sends no emails until you resume it."}
              </p>
              <Button type="submit" variant="secondary" className="mt-3">
                {alert.active ? "Pause alert" : "Resume alert"}
              </Button>
            </Form>
            <Form
              method="post"
              className="p-3 sm:p-4"
              onSubmit={(event) => {
                if (!confirm(`Delete the price alert for ${alert.cardName}?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <p className="text-[12.5px] text-mute">Deleting removes the alert for good.</p>
              <Button type="submit" variant="danger" className="mt-3">
                Delete alert
              </Button>
            </Form>
          </div>
        </Panel>
      </PanelGrid>
    </PageBody>
  );
}
