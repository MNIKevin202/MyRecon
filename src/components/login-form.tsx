"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button, Field, Input, Panel } from "@/components/ui";
import { api } from "@/lib/utils";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Panel className="w-full max-w-md">
        <form action={submit} className="grid gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="text-sm text-slate-400">Manage your configured Rust servers.</p>
            </div>
          </div>
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}
          <Button disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
        </form>
      </Panel>
    </main>
  );
}
