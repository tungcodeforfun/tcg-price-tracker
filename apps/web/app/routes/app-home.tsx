import { useRouteLoaderData } from "react-router";
import type { Route } from "./+types/app-home";
import type { loader as appLoader } from "./app-layout";

export const meta: Route.MetaFunction = () => [{ title: "Dashboard · TCG Price Tracker" }];

export default function AppHome() {
  const data = useRouteLoaderData<typeof appLoader>("routes/app-layout");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {data?.user.name}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Signed in as {data?.user.email}.</p>
    </>
  );
}
