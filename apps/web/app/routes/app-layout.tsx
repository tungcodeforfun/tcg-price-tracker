import { Form, NavLink, Outlet } from "react-router";
import { requireSession } from "~/.server/session";
import { Button } from "~/components/terminal/button";
import { SiteFooter, SiteHeader, useFeedbackHref } from "~/components/terminal/site-chrome";
import type { Route } from "./+types/app-layout";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/collection", label: "Collection", end: false },
  { to: "/app/sales", label: "Sales", end: false },
  { to: "/app/alerts", label: "Alerts", end: false },
  { to: "/app/feedback", label: "Feedback", end: true },
  { to: "/games", label: "Browse cards", end: false },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return { user: { name: user.name, email: user.email } };
}

/** Child routes don't export `headers`, so this applies to every signed-in page. */
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store" });

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const feedbackHref = useFeedbackHref();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        actions={
          <>
            <span className="max-w-[16rem] truncate text-[11.5px] text-mute">
              {loaderData.user.email}
            </span>
            <Form method="post" action="/logout">
              <Button variant="secondary" size="sm">
                Log out
              </Button>
            </Form>
          </>
        }
      />
      <div className="border-b border-grid bg-void">
        <nav
          aria-label="Account"
          className="mx-auto flex max-w-[1440px] overflow-x-auto px-3 whitespace-nowrap sm:px-4"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to === "/app/feedback" ? feedbackHref : item.to}
              end={item.end}
              className="flex h-9 items-center border-b-2 border-transparent px-3 text-[11px] tracking-[0.12em] text-mute uppercase hover:text-text focus-visible:outline-offset-[-2px] aria-[current=page]:border-amber aria-[current=page]:text-text"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
