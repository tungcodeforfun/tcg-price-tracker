import { Form, Link, NavLink, Outlet } from "react-router";
import { requireSession } from "~/.server/session";
import type { Route } from "./+types/app-layout";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/collection", label: "Collection", end: false },
  { to: "/app/sales", label: "Sales", end: false },
  { to: "/app/alerts", label: "Alerts", end: false },
  { to: "/games", label: "Browse cards", end: false },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return { user: { name: user.name, email: user.email } };
}

/** Child routes don't export `headers`, so this applies to every signed-in page. */
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store" });

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <Link to="/app" className="font-semibold">
          TCG Price Tracker
        </Link>
        <nav aria-label="Main" className="flex gap-4 text-sm">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="hover:underline aria-[current]:font-semibold"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">{loaderData.user.email}</span>
          <Form method="post" action="/logout">
            <button type="submit" className="underline">
              Log out
            </button>
          </Form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
