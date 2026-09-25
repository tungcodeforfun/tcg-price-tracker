import { data } from "react-router";
import {
  AuthCard,
  AuthForm,
  FormMessage,
  SubmitButton,
  TextField,
  formString,
} from "~/components/auth-form";
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
      <AuthCard title="Check your inbox">
        <FormMessage tone="success">
          If an account exists for that email, we sent a link to reset your password.
        </FormMessage>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password">
      <AuthForm>
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <TextField label="Email" name="email" type="email" autoComplete="email" />
        <SubmitButton>Send reset link</SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
