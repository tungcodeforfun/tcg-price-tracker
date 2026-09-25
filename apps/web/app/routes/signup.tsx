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
import { getSession } from "~/.server/session";
import type { Route } from "./+types/signup";

export const meta: Route.MetaFunction = () => [{ title: "Sign up · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSession(request)) throw redirect("/app");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = formString(form, "email");
  const result = await callAuth(request, "/sign-up/email", {
    name: formString(form, "name"),
    email,
    password: form.get("password"),
    callbackURL: "/app",
  });
  if (!result.ok)
    return data({ sent: false, error: authErrorMessage(result), email }, { status: result.status });
  return { sent: true, error: null, email };
}

export default function Signup({ actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <AuthCard title="Check your inbox">
        <FormMessage tone="success">
          We sent a verification link to {actionData.email}. Open it to finish creating your
          account.
        </FormMessage>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </>
      }
    >
      <AuthForm>
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        <TextField label="Name" name="name" autoComplete="name" />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={actionData?.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
        />
        <SubmitButton>Sign up</SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
