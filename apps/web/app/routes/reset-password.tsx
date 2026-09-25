import { data, Form, redirect } from "react-router";
import { AuthLink, AuthPanel, AuthSubmit } from "~/components/auth-panel";
import { Field, FormMessage, TextInput } from "~/components/terminal/form";
import { formString } from "~/lib/form";
import { authErrorMessage, callAuth } from "~/.server/auth-request";
import type { Route } from "./+types/reset-password";

export const meta: Route.MetaFunction = () => [
  { title: "Choose a new password · TCG Price Tracker" },
];

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  return { token: url.searchParams.has("error") ? null : token };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const password = form.get("password");
  if (password !== form.get("confirmPassword")) {
    return data({ error: "Passwords don't match." }, { status: 400 });
  }
  const result = await callAuth(request, "/reset-password", {
    newPassword: password,
    token: formString(form, "token"),
  });
  if (!result.ok) return data({ error: authErrorMessage(result) }, { status: result.status });
  return redirect("/login?reset=1");
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.token) {
    return (
      <AuthPanel
        section="Reset link"
        title="Link expired"
        footer={<AuthLink to="/forgot-password">Request a new link</AuthLink>}
      >
        <FormMessage tone="error">This reset link is invalid or has expired.</FormMessage>
      </AuthPanel>
    );
  }
  return (
    <AuthPanel section="New password" title="Choose a new password">
      <Form method="post" className="space-y-4">
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <input type="hidden" name="token" value={loaderData.token} />
        <Field label="New password">
          <TextInput
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>
        <Field label="Confirm password">
          <TextInput
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>
        <AuthSubmit>Update password</AuthSubmit>
      </Form>
    </AuthPanel>
  );
}
