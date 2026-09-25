import { data, Form } from "react-router";
import { AuthLink, AuthPanel, AuthSubmit } from "~/components/auth-panel";
import { Field, FormMessage, TextInput } from "~/components/terminal/form";
import { formString } from "~/lib/form";
import { authErrorMessage, callAuth } from "~/.server/auth-request";
import { env } from "~/.server/env";
import type { Route } from "./+types/forgot-password";

export const meta: Route.MetaFunction = () => [{ title: "Reset password · TCG Price Tracker" }];

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const result = await callAuth(request, "/request-password-reset", {
    email: formString(form, "email"),
    redirectTo: `${env.appUrl}/reset-password`,
  });
  // Same response whether or not the account exists; only throttling is surfaced.
  if (result.status === 429)
    return data({ sent: false, error: authErrorMessage(result) }, { status: 429 });
  return { sent: true, error: null };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <AuthPanel section="Reset link" title="Check your inbox">
        <FormMessage tone="success">
          If an account exists for that email, we sent a link to reset your password.
        </FormMessage>
      </AuthPanel>
    );
  }
  return (
    <AuthPanel
      section="Reset link"
      title="Reset your password"
      footer={
        <>
          Remembered it? <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      <Form method="post" className="space-y-4">
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <Field label="Email">
          <TextInput name="email" type="email" autoComplete="email" required />
        </Field>
        <AuthSubmit>Send reset link</AuthSubmit>
      </Form>
    </AuthPanel>
  );
}
