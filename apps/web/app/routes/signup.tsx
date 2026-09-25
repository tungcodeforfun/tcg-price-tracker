import { data, Form, redirect } from "react-router";
import { AuthLink, AuthPanel, AuthSubmit } from "~/components/auth-panel";
import { Field, FormMessage, TextInput } from "~/components/terminal/form";
import { formString } from "~/lib/form";
import { authErrorMessage, callAuth } from "~/.server/auth-request";
import { env } from "~/.server/env";
import { getSession } from "~/.server/session";
import type { Route } from "./+types/signup";

export const meta: Route.MetaFunction = () => [{ title: "Sign up · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSession(request)) throw redirect("/app");
  const invite = new URL(request.url).searchParams.get("invite") ?? "";
  return { invitesRequired: env.invitesRequired, invite };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = formString(form, "email");
  const inviteCode = formString(form, "inviteCode");
  const result = await callAuth(request, "/sign-up/email", {
    name: formString(form, "name"),
    email,
    password: form.get("password"),
    inviteCode,
    callbackURL: "/app",
  });
  if (!result.ok) {
    return data(
      { sent: false, error: authErrorMessage(result), email, inviteCode },
      { status: result.status },
    );
  }
  return { sent: true, error: null, email, inviteCode };
}

export default function Signup({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <AuthPanel section="Verification" title="Check your inbox">
        <FormMessage tone="success" className="break-words">
          We sent a verification link to {actionData.email}. Open it to finish creating your
          account.
        </FormMessage>
      </AuthPanel>
    );
  }
  return (
    <AuthPanel
      section="New account"
      title="Create your account"
      footer={
        <>
          Already have an account? <AuthLink to="/login">Log in</AuthLink>
        </>
      }
    >
      <Form method="post" className="space-y-4">
        {actionData?.error && <FormMessage tone="error">{actionData.error}</FormMessage>}
        {loaderData.invitesRequired && (
          <>
            <FormMessage tone="info">Private beta: sign-up needs an invite code.</FormMessage>
            <Field label="Invite code">
              <TextInput
                name="inviteCode"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                defaultValue={actionData?.inviteCode ?? loaderData.invite}
                required
              />
            </Field>
          </>
        )}
        <Field label="Name">
          <TextInput name="name" autoComplete="name" required />
        </Field>
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
          <TextInput
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>
        <AuthSubmit>Sign up</AuthSubmit>
      </Form>
    </AuthPanel>
  );
}
