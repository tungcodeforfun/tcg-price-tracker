import { ALERT_COOLDOWN_HOURS, listAlerts } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { describeRule, describeStatus } from "~/components/alert-form";
import { formatPrice } from "~/lib/format";
import type { Route } from "./+types/app-alerts";

export const meta: Route.MetaFunction = () => [{ title: "Price alerts · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return { alerts: await listAlerts(db, user.id), cooldownHours: ALERT_COOLDOWN_HOURS };
}

export default function Alerts({ loaderData }: Route.ComponentProps) {
  const { alerts, cooldownHours } = loaderData;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Price alerts</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
        After each daily price update, an alert emails you when the price crosses your target. It
        fires again only after the price moves back across the target, and at most once every{" "}
        {cooldownHours} hours.
      </p>

      {alerts.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-400">
          No alerts yet.{" "}
          <Link to="/games" className="underline">
            Browse cards
          </Link>
          , open a card and choose “Set price alert”.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 font-medium">Card</th>
                <th className="py-2 pl-3 font-medium">Set</th>
                <th className="py-2 pl-3 font-medium">Printing / condition</th>
                <th className="py-2 pl-3 font-medium">Rule</th>
                <th className="py-2 pl-3 text-right font-medium">Current price</th>
                <th className="py-2 pl-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {alerts.map((a) => (
                <tr key={a.id} className={a.active ? undefined : "text-gray-500"}>
                  <td className="py-2">
                    <Link to={`/cards/${a.cardSlug}`} className="hover:underline">
                      {a.cardName}
                    </Link>
                  </td>
                  <td className="py-2 pl-3">{a.setName}</td>
                  <td className="py-2 pl-3">
                    {a.printing} · {a.condition}
                    {a.language !== "English" && (
                      <span className="text-gray-500"> ({a.language})</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 tabular-nums">{describeRule(a)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{formatPrice(a.priceCents)}</td>
                  <td className="py-2 pl-3">{describeStatus(a)}</td>
                  <td className="py-2 pl-3">
                    <Link to={`/app/alerts/${a.id}`} className="underline">
                      Manage<span className="sr-only"> alert for {a.cardName}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
