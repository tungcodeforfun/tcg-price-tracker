import { MAX_FEEDBACK_LENGTH, recordFeedback, ValidationError } from "~/.server/catalog";
import { data, Form, redirect, useLocation, useNavigation } from "react-router";
import { db } from "~/.server/db";
import { feedbackEmail } from "~/.server/emails";
import { env } from "~/.server/env";
import { sendInBackground } from "~/.server/mailer";
import { requireSession } from "~/.server/session";
import { Button } from "~/components/terminal/button";
import { Field, FormMessage, Textarea } from "~/components/terminal/form";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { formString } from "~/lib/form";
import { safeRedirect } from "~/lib/safe-redirect";
import type { Route } from "./+types/app-feedback";

export const meta: Route.MetaFunction = () => [{ title: "Feedback · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request);
  const url = new URL(request.url);
  return {
    pagePath: safeRedirect(url.searchParams.get("from"), "") || null,
    sent: url.searchParams.get("sent") === "1",
    maxLength: MAX_FEEDBACK_LENGTH,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  const message = formString(form, "message");
  const pagePath = safeRedirect(form.get("pagePath"), "") || null;
  try {
    await recordFeedback(db, { userId: user.id, email: user.email, message, pagePath });
  } catch (error) {
    if (error instanceof ValidationError) {
      return data({ error: error.message, message }, { status: 400 });
    }
    throw error;
  }
  if (env.feedbackEmail) {
    sendInBackground(
      feedbackEmail(env.feedbackEmail, { email: user.email, userId: user.id, message, pagePath }),
    );
  }
  return redirect("/app/feedback?sent=1");
}

export default function Feedback({ loaderData, actionData }: Route.ComponentProps) {
  const { pagePath, sent, maxLength } = loaderData;
  const busy = useNavigation().state === "submitting";
  // A new location means the last message was sent, so the next one starts blank.
  const { key } = useLocation();

  return (
    <PageBody>
      <PageHeader eyebrow="ACCT ▸ Feedback" title="Send feedback" />
      <Panel title="Message" className="max-w-2xl border border-grid">
        <Form key={key} method="post" className="space-y-4 p-3 sm:p-4">
          {actionData?.error ? (
            <FormMessage tone="error">{actionData.error}</FormMessage>
          ) : (
            sent && <FormMessage tone="success">Thanks, we got your feedback.</FormMessage>
          )}
          {pagePath && <input type="hidden" name="pagePath" value={pagePath} />}
          <Field
            label="What's working, what's broken, what's missing?"
            hint={
              pagePath
                ? `Sent with the page you came from: ${pagePath}`
                : `Up to ${maxLength.toLocaleString("en-US")} characters.`
            }
          >
            <Textarea
              name="message"
              rows={8}
              maxLength={maxLength}
              defaultValue={actionData?.message}
              aria-invalid={actionData?.error ? true : undefined}
              required
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send feedback"}
          </Button>
        </Form>
      </Panel>
    </PageBody>
  );
}
