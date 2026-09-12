"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Fingerprint, Loader2 } from "lucide-react";
import { loginTeam } from "@/server/auth/actions";
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
        <Fingerprint className="h-4 w-4" />
      )}
      {pending ? "Establishing channel" : "Authenticate"}
    </Button>
  );
}

export function TeamLoginForm() {
  const [state, formAction] = useActionState(loginTeam, initialAuthState);

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

      <Field
        label="Unit designation"
        htmlFor="teamName"
        hint="Issued at check-in. Case-insensitive."
      >
        <TextInput
          id="teamName"
          name="teamName"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. NIGHT-OWL-07"
        />
      </Field>

      <Field label="Access code" htmlFor="accessCode">
        <TextInput
          id="accessCode"
          name="accessCode"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          placeholder="••••••••••"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
