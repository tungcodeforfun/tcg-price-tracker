import { Link } from "react-router";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "TCG Price Tracker" },
  { name: "description", content: "Track trading card prices and your collection's value." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">TCG Price Tracker</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Track trading card prices and your collection's value.
      </p>
      <div className="mt-8 flex gap-3 text-sm font-medium">
        <Link
          to="/signup"
          className="rounded-md bg-gray-900 px-4 py-2 text-white dark:bg-gray-100 dark:text-gray-900"
        >
          Get started
        </Link>
        <Link
          to="/login"
          className="rounded-md border border-gray-300 px-4 py-2 dark:border-gray-700"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
