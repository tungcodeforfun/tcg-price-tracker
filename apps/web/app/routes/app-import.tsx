import { importHoldingsCsv, MAX_IMPORT_ROWS } from "~/.server/catalog";
import { data, Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { FormMessage, SubmitButton } from "~/components/auth-form";
import { inputClass } from "~/components/portfolio-form";
import type { Route } from "./+types/app-import";

const MAX_BYTES = 1024 * 1024;
/** Room for multipart boundaries and headers on top of a maximum-size file. */
const MULTIPART_OVERHEAD = 64 * 1024;
const TOO_LARGE = "The CSV must be 1 MB or smaller.";

const COLUMNS: { name: string; description: string }[] = [
  { name: "variant_id", description: "The tracker's variant ID (as in an exported holdings CSV)." },
  { name: "tcgplayer_sku_id", description: "TCGplayer SKU ID, instead of variant_id." },
  {
    name: "set, number, condition, printing, language",
    description:
      "Instead of an ID: set ID or name, card number and condition (e.g. Near Mint). printing and language are only needed when the card comes in more than one.",
  },
  { name: "quantity", description: "Required. A whole number, 1 or more." },
  { name: "unit_cost", description: "Optional. Price paid per card in dollars, like 12.50." },
  { name: "acquired_on", description: "Optional. Date as YYYY-MM-DD." },
  { name: "notes", description: "Optional." },
];

const EXAMPLE = `set,number,condition,printing,quantity,unit_cost,acquired_on,notes
Base Set,4/102,Near Mint,Holofoil,1,350.00,2024-05-01,Graded soon`;

export const meta: Route.MetaFunction = () => [{ title: "Import CSV · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request);
  return { maxRows: MAX_IMPORT_ROWS };
}

function failure(
  formError: string | null,
  csv = "",
  lineErrors: { line: number; message: string }[] = [],
) {
  return data({ formError, lineErrors, csv }, { status: 400 });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BYTES + MULTIPART_OVERHEAD) {
    return failure(TOO_LARGE);
  }
  const form = await request.formData();
  const file = form.get("file");
  const pasted = form.get("csv");
  const fromFile = file instanceof File && file.size > 0;
  if (fromFile && file.size > MAX_BYTES) return failure(TOO_LARGE);
  const csv = fromFile ? await file.text() : typeof pasted === "string" ? pasted : "";
  if (csv.length > MAX_BYTES) return failure(TOO_LARGE);
  if (csv.trim() === "") return failure("Choose a CSV file or paste CSV text.", csv);

  const result = await importHoldingsCsv(db, user.id, csv);
  if (!result.ok) return failure(null, fromFile ? "" : csv, result.errors);
  return redirect(`/app/collection?imported=${result.imported}`);
}

export default function ImportCsv({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm">
        <Link to="/app/collection" className="text-gray-500 hover:underline">
          ← Collection
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import CSV</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Each row adds a lot to your collection. Nothing is imported unless every row is valid. Up to{" "}
        {loaderData.maxRows.toLocaleString("en-US")} rows and 1 MB per import.
      </p>

      <Form method="post" encType="multipart/form-data" className="mt-6 space-y-4">
        {actionData?.formError && <FormMessage tone="error">{actionData.formError}</FormMessage>}
        {actionData && actionData.lineErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <p className="font-medium">Nothing was imported. Fix these rows and try again:</p>
            <ul className="mt-2 max-h-64 list-inside list-disc overflow-y-auto">
              {actionData.lineErrors.map((e, i) => (
                <li key={i}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium">CSV file</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm dark:file:border-gray-700"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Or paste CSV text</span>
          <textarea
            name="csv"
            rows={8}
            defaultValue={actionData?.csv}
            placeholder={EXAMPLE}
            className={`${inputClass} font-mono`}
          />
        </label>
        <SubmitButton>Import</SubmitButton>
      </Form>

      <section className="mt-10" aria-labelledby="columns-heading">
        <h2 id="columns-heading" className="text-lg font-semibold">
          Columns
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The first row must be a header. Identify each card by <code>variant_id</code>, by{" "}
          <code>tcgplayer_sku_id</code>, or by <code>set</code> + <code>number</code> +{" "}
          <code>condition</code> (+ <code>printing</code>, <code>language</code>).
        </p>
        <dl className="mt-3 divide-y divide-gray-200 text-sm dark:divide-gray-800">
          {COLUMNS.map((c) => (
            <div key={c.name} className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
              <dt className="font-mono">{c.name}</dt>
              <dd className="text-gray-600 dark:text-gray-400">{c.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm font-medium">Example</p>
        <pre className="mt-1 overflow-x-auto rounded-md bg-gray-100 p-3 text-xs dark:bg-gray-900">
          {EXAMPLE}
        </pre>
      </section>
    </div>
  );
}
