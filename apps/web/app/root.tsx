import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import { useEffect, useRef } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { env } from "~/.server/env";
import { ButtonLink } from "~/components/terminal/button";
import { PageBody } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { SiteFooter, SiteHeader } from "~/components/terminal/site-chrome";

/** Site-wide footer settings; static per deploy, so never refetched after the first load. */
export function loader() {
  return { takedownEmail: env.takedownEmail };
}

export const shouldRevalidate = () => false;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Counts views client-side, so pages a CDN serves are still counted; the server ignores bots. */
function usePageViewBeacon() {
  const { pathname } = useLocation();
  // Dev StrictMode runs effects twice; one view per path change.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (navigator.webdriver) return;
    const send = () => {
      if (sent.current === pathname) return;
      sent.current = pathname;
      const body = new Blob([JSON.stringify({ path: pathname })], { type: "application/json" });
      navigator.sendBeacon("/api/pv", body);
    };
    // A speculatively prerendered page counts only once the visitor actually opens it.
    if ((document as Document & { prerendering?: boolean }).prerendering) {
      document.addEventListener("prerenderingchange", send, { once: true });
      return () => document.removeEventListener("prerenderingchange", send);
    }
    send();
  }, [pathname]);
}

export default function App() {
  usePageViewBeacon();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = "Unhandled error";
  let title = "Something went wrong";
  let details = "An unexpected error occurred. Try again in a moment.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = `HTTP ${error.status}`;
    if (error.status === 404) {
      title = "Page not found";
      details =
        "No card, set or page lives at this address. It may have moved, or the link is wrong.";
    } else {
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <title>{`${title} · TCG Price Tracker`}</title>
      <SiteHeader />
      <main className="flex-1">
        <PageBody>
          <Panel code="ERR" title={status} className="max-w-3xl border border-grid">
            <div className="px-4 py-6 sm:px-6 sm:py-8">
              <h1 className="font-sans text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-[40px]">
                {title}
              </h1>
              <p className="mt-3 max-w-prose text-mute">{details}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink to="/">Market overview</ButtonLink>
                <ButtonLink to="/games" variant="secondary">
                  Browse games
                </ButtonLink>
              </div>
            </div>
            {stack && (
              <pre className="overflow-x-auto border-t border-grid p-4 text-[11.5px] text-mute">
                <code>{stack}</code>
              </pre>
            )}
          </Panel>
        </PageBody>
      </main>
      <SiteFooter />
    </div>
  );
}
