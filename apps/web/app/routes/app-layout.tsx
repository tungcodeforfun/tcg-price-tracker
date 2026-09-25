import { Form, Link, Outlet } from "react-router";
import { requireSession } from "~/.server/session";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return { user: { name: user.name, email: user.email } };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <Link to="/app" className="font-semibold">
          TCG Price Tracker
        </Link>
        <div className="flex items-center gap-4 text-sm">
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
