import { exportSalesCsv } from "~/.server/catalog";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import type { Route } from "./+types/app-export-sales";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return new Response(await exportSalesCsv(db, user.id), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sales.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
