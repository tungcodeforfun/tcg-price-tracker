import { ALERT_COOLDOWN_HOURS, listAlerts } from "~/.server/catalog";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { AlertRule, AlertStatus, DistanceToTarget } from "~/components/alert-form";
import { ButtonLink } from "~/components/terminal/button";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Price } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import type { Route } from "./+types/app-alerts";

export const meta: Route.MetaFunction = () => [{ title: "Price alerts · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return { alerts: await listAlerts(db, user.id), cooldownHours: ALERT_COOLDOWN_HOURS };
}

export default function Alerts({ loaderData }: Route.ComponentProps) {
  const { alerts, cooldownHours } = loaderData;
  const active = alerts.filter((a) => a.active).length;

  return (
    <PageBody>
      <PageHeader
        eyebrow="ACCT ▸ Alerts"
        title="Price alerts"
        meta={alerts.length > 0 && `${active} active · ${alerts.length - active} paused`}
      />
      <FormMessage tone="info" className="mb-3">
        After each daily price update, an alert emails you when the price crosses your target. It
        fires again only after the price moves back across the target, and at most once every{" "}
        {cooldownHours} hours. MET means the price is already there and you’ll be emailed after the
        next update.
        <span className="hidden sm:inline"> “To target” is the move the price still needs.</span>
      </FormMessage>

      <Panel
        title="Alerts"
        meta={`${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"}`}
        className="border border-grid"
      >
        {alerts.length === 0 ? (
          <EmptyState
            title="No alerts yet"
            action={
              <ButtonLink to="/games" variant="secondary">
                Browse cards
              </ButtonLink>
            }
          >
            Open a card and choose “Set price alert” to watch its price.
          </EmptyState>
        ) : (
          <DataTable caption="Your price alerts. Select a row to manage the alert.">
            <thead>
              <tr>
                <Th>Card</Th>
                <Th className="hidden sm:table-cell">Printing / condition</Th>
                <Th>Rule</Th>
                <Th numeric>Last</Th>
                <Th numeric className="hidden sm:table-cell">
                  To target
                </Th>
                <Th className="hidden sm:table-cell">Status</Th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className={a.active ? undefined : "text-mute"}>
                  <td className="min-w-36 whitespace-normal sm:whitespace-nowrap">
                    <RowLink to={`/app/alerts/${a.id}`} className="font-medium">
                      {a.cardName}
                      <span className="block text-[11px] font-normal text-mute">
                        <span className="hidden sm:inline">{a.setName}</span>
                        <span className="sm:sr-only">
                          {a.printing} · {a.condition}
                        </span>
                      </span>
                      <span className="mt-1 block font-normal sm:hidden">
                        <AlertStatus alert={a} />
                      </span>
                    </RowLink>
                  </td>
                  <td className="hidden sm:table-cell">
                    {a.printing} · {a.condition}
                    {a.language !== "English" && <span className="text-mute"> · {a.language}</span>}
                  </td>
                  <td>
                    <AlertRule alert={a} tagClassName="hidden sm:inline" />
                  </td>
                  <td className="text-right">
                    <Price cents={a.priceCents} />
                  </td>
                  <td className="hidden text-right sm:table-cell">
                    <DistanceToTarget alert={a} />
                  </td>
                  <td className="hidden sm:table-cell">
                    <AlertStatus alert={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </PageBody>
  );
}
