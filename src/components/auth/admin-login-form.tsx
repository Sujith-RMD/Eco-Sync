"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, ScanLine } from "lucide-react";
import { loginAdmin } from "@/server/auth/actions";
import { initialAuthState } from "@/types/auth";
import { Field, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ScanLine className="h-4 w-4" />
      )}
      {pending ? "Verifying operator" : "Access command deck"}
    </Button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(loginAdmin, initialAuthState);

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 border border-alert/40 bg-alert/10 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : null}

      <Field label="Operator ID" htmlFor="username">
        <TextInput
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={80}
          autoComplete="username"
          spellCheck={false}
          placeholder="operator"
        />
      </Field>

      <Field label="Passphrase" htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          placeholder="••••••••••••"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
