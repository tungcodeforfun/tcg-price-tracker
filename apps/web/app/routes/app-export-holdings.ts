import { exportHoldingsCsv } from "~/.server/catalog";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import type { Route } from "./+types/app-export-holdings";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  return new Response(await exportHoldingsCsv(db, user.id), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="holdings.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
