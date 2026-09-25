import { data, Form, redirect } from "react-router";
import { AuthLink, AuthPanel, AuthSubmit } from "~/components/auth-panel";
import { Field, FormMessage, TextInput } from "~/components/terminal/form";
import { formString } from "~/lib/form";
import { authErrorMessage, callAuth } from "~/.server/auth-request";
import { getSession } from "~/.server/session";
import { safeRedirect } from "~/lib/safe-redirect";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [{ title: "Log in · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  if (await getSession(request)) throw redirect(redirectTo);
  return { redirectTo, passwordReset: url.searchParams.has("reset") };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = formString(form, "email");
  const result = await callAuth(request, "/sign-in/email", {
    email,
    password: form.get("password"),
  });
  if (!result.ok)
    return data({ error: authErrorMessage(result), email }, { status: result.status });
  return redirect(safeRedirect(form.get("redirectTo")), { headers: result.headers });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <AuthPanel
      section="Credentials"
      title="Log in"
      footer={
        <>
          New here? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      <Form method="post" className="space-y-4">
        {loaderData.passwordReset && !actionData && (
          <FormMessage tone="success">Password updated. Log in with your new password.</FormMessage>
        )}
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <Field label="Email">
          <TextInput
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={actionData?.email}
            required
          />
        </Field>
        <Field label="Password">
          <TextInput name="password" type="password" autoComplete="current-password" required />
        </Field>
        <AuthSubmit>Log in</AuthSubmit>
        <p className="text-[12px]">
          <AuthLink to="/forgot-password">Forgot your password?</AuthLink>
        </p>
      </Form>
    </AuthPanel>
  );
}
