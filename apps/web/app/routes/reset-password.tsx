import { data, Link, redirect } from "react-router";
import {
  AuthCard,
  AuthForm,
  FormMessage,
  SubmitButton,
  TextField,
  formString,
} from "~/components/auth-form";
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
      <AuthCard title="Link expired">
        <FormMessage tone="error">This reset link is invalid or has expired.</FormMessage>
        <p className="mt-4 text-sm">
          <Link to="/forgot-password" className="underline">
            Request a new link
          </Link>
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password">
      <AuthForm>
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <input type="hidden" name="token" value={loaderData.token} />
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
        />
        <SubmitButton>Update password</SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
