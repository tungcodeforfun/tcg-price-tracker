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
    </main>
  );
}
