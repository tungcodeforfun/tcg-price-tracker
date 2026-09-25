import { importHoldingsCsv, MAX_IMPORT_ROWS } from "~/.server/catalog";
import { data, Form, redirect } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { SubmitButton } from "~/components/portfolio-form";
import { DataTable, Th } from "~/components/terminal/data-table";
import { Field, FormMessage, Textarea, TextInput } from "~/components/terminal/form";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
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
    <PageBody>
      <Breadcrumbs items={[{ label: "Collection", to: "/app/collection" }, { label: "Import" }]} />
      <PageHeader eyebrow="ACCT ▸ Collection" title="Import CSV" />
      <PanelGrid className="lg:grid-cols-12">
        <Panel code="F1" title="Upload" className="lg:col-span-7">
          <Form method="post" encType="multipart/form-data" className="space-y-4 p-3 sm:p-4">
            <p className="text-[12.5px] text-mute">
              Each row adds a lot to your collection. Nothing is imported unless every row is valid.
              Up to {loaderData.maxRows.toLocaleString("en-US")} rows and 1 MB per import.
            </p>
            {actionData?.formError && (
              <FormMessage tone="error">{actionData.formError}</FormMessage>
            )}
            {actionData && actionData.lineErrors.length > 0 && (
              <FormMessage tone="error">
                <p>Nothing was imported. Fix these rows and try again:</p>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {actionData.lineErrors.map((e, i) => (
                    <li key={i}>
                      <span className="text-down">Line {e.line}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              </FormMessage>
            )}
            <Field label="CSV file">
              <TextInput type="file" name="file" accept=".csv,text/csv" />
            </Field>
            <Field label="Or paste CSV text">
              <Textarea name="csv" rows={8} defaultValue={actionData?.csv} placeholder={EXAMPLE} />
            </Field>
            <SubmitButton>Import</SubmitButton>
          </Form>
        </Panel>

        <Panel code="F2" title="Columns" className="lg:col-span-5">
          <p className="px-3 py-3 text-[12.5px] text-mute">
            The first row must be a header. Identify each card by <code>variant_id</code>, by{" "}
            <code>tcgplayer_sku_id</code>, or by <code>set</code> + <code>number</code> +{" "}
            <code>condition</code> (+ <code>printing</code>, <code>language</code>).
          </p>
          <DataTable caption="CSV columns" className="border-t border-grid">
            <thead>
              <tr>
                <Th>Column</Th>
                <Th>Meaning</Th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name}>
                  <td className="align-top whitespace-normal text-amber">{c.name}</td>
                  <td className="min-w-48 whitespace-normal text-mute">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="border-t border-grid px-3 py-3">
            <p className="micro">Example</p>
            <pre className="mt-1.5 overflow-x-auto border border-grid bg-void p-3 text-[11.5px]">
              {EXAMPLE}
            </pre>
          </div>
        </Panel>
      </PanelGrid>
    </PageBody>
  );
}
