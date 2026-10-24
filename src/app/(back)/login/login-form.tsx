"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { errorProps, Field, Input } from "@/components/ui/field";
import { DEMO_REPO_URL } from "@/demo/config";
import { useAdminI18n } from "@/i18n/admin/client";
import { login, loginAsDemo, type LoginState } from "./actions";

/**
 * Demo version: the admin form is always shown, so visitors see the full sign-in. It works where
 * ADMIN_EMAIL and ADMIN_PASSWORD are set (locally); on the public demo it is switched off and says
 * how to run the project with an admin.
 */
export function LoginForm({ adminEnabled }: { adminEnabled: boolean }) {
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const { t } = useAdminI18n();

  return (
    <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm">
      <form action={loginAsDemo}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" className="w-full">
          {t.login.tryDemo}
        </Button>
        <p className="text-muted mt-2 text-center text-xs">{t.login.demoNote}</p>
        {params.get("demo") === "busy" ? (
          <p role="alert" className="bg-warn-soft text-warn mt-3 rounded-lg px-3 py-2 text-sm">
            {t.login.demoBusy}
          </p>
        ) : null}
      </form>

      <>
        <div className="text-muted my-6 flex items-center gap-3 text-xs">
          <span className="bg-line h-px flex-1" />
          {t.login.orAdmin}
          <span className="bg-line h-px flex-1" />
        </div>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          {!adminEnabled ? (
            <p className="bg-canvas text-muted rounded-lg px-3 py-2 text-xs leading-relaxed">
              {t.login.adminDisabledHint}{" "}
              <a
                href={`${DEMO_REPO_URL}#running-it-locally`}
                target="_blank"
                rel="noopener"
                className="text-accent underline underline-offset-2"
              >
                {t.login.howToRun}
              </a>
            </p>
          ) : null}
          <fieldset disabled={!adminEnabled} className="flex flex-col gap-4 disabled:opacity-60">
            <Field label={t.login.email} htmlFor="email" errors={state.fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                {...errorProps("email", state.fieldErrors?.email)}
              />
            </Field>
            <Field label={t.login.password} htmlFor="password" errors={state.fieldErrors?.password}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                {...errorProps("password", state.fieldErrors?.password)}
              />
            </Field>
            {state.error ? (
              <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" disabled={pending || !adminEnabled}>
              {pending ? t.login.signingIn : t.login.signIn}
            </Button>
          </fieldset>
        </form>
      </>
    </div>
  );
}
