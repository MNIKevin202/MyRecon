"use client";

import { useState } from "react";
import { CheckCircle2, ServerCog } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api } from "@/lib/utils";

type SetupResponse = {
  serverId: string;
  connection: { ok: boolean; message: string };
};

export function SetupWizard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"fresh" | "import">("fresh");

  async function importSetup(formData: FormData) {
    setBusy(true); setMessage(null); setConnectionOk(null);
    try {
      const file = formData.get("backup") as File | null;
      if (!file || file.size === 0) throw new Error("Choose your backup file.");
      const backup = await file.text();
      const data = await api<{ imported: number; skipped: number }>("/api/setup/import", {
        method: "POST",
        body: JSON.stringify({
          backup,
          passphrase: formData.get("passphrase"),
          ownerName: formData.get("ownerName"),
          ownerEmail: formData.get("ownerEmail"),
          ownerPassword: formData.get("ownerPassword"),
        }),
      });
      setConnectionOk(true);
      setMessage(`Imported ${data.imported} server(s)${data.skipped ? `, ${data.skipped} skipped` : ""}. Opening dashboard...`);
      window.setTimeout(() => { window.location.href = "/dashboard"; }, 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    setConnectionOk(null);

    try {
      const payload = Object.fromEntries(formData.entries());
      const result = await api<SetupResponse>("/api/setup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setConnectionOk(result.connection.ok);
      setMessage(
        result.connection.ok
          ? "Configuration saved and WebRCON responded. Opening dashboard..."
          : `Configuration saved. Connection test needs attention: ${result.connection.message}`,
      );
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl content-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="flex flex-col justify-center gap-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-500">
            <ServerCog className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-normal text-white">MyRcon</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-400">
              Configure the first owner account and Rust server. Credentials are encrypted at rest and only used by server-side API routes.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-300">
            {["Multi-server ready", "WebRCON command path", "SQLite local install"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-orange-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Panel>
          <div className="mb-5 flex gap-1 border-b border-white/10">
            <button onClick={() => { setMode("fresh"); setMessage(null); }} className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${mode === "fresh" ? "border-orange-400 text-orange-100" : "border-transparent text-slate-400 hover:text-white"}`}>Start Fresh</button>
            <button onClick={() => { setMode("import"); setMessage(null); }} className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${mode === "import" ? "border-orange-400 text-orange-100" : "border-transparent text-slate-400 hover:text-white"}`}>Import a Backup</button>
          </div>

          {mode === "import" && (
            <form action={importSetup} className="grid gap-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Import Existing Setup</h2>
                <p className="mt-1 text-sm text-slate-400">Already set up on another machine? Export a backup there (Settings → Backup &amp; Transfer), then import it here — no retyping.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Owner name"><Input name="ownerName" required minLength={2} autoComplete="name" /></Field>
                <Field label="Owner email"><Input name="ownerEmail" type="email" required autoComplete="email" /></Field>
                <Field label="Owner password" hint="Use at least 10 characters."><Input name="ownerPassword" type="password" required minLength={10} autoComplete="new-password" /></Field>
                <Field label="Backup passphrase" hint="The passphrase you set when exporting."><Input name="passphrase" type="password" required /></Field>
              </div>
              <Field label="Backup file (.myrcon)">
                <input name="backup" type="file" accept=".myrcon,application/octet-stream,text/plain" required className="text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white" />
              </Field>
              {message ? <div className={`rounded-md border px-3 py-2 text-sm ${connectionOk === false ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>{message}</div> : null}
              <Button disabled={busy} className="w-full sm:w-auto">{busy ? "Importing..." : "Import and Open Dashboard"}</Button>
            </form>
          )}

          {mode === "fresh" && (
          <form action={submit} className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold text-white">First Run Setup</h2>
              <p className="mt-1 text-sm text-slate-400">No server-specific values are bundled. Add your own profile to begin.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Owner name">
                <Input name="ownerName" required minLength={2} autoComplete="name" />
              </Field>
              <Field label="Owner email">
                <Input name="ownerEmail" type="email" required autoComplete="email" />
              </Field>
              <Field label="Owner password" hint="Use at least 10 characters.">
                <Input name="ownerPassword" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
              <Field label="Server name">
                <Input name="name" required minLength={2} placeholder="Main Modded" />
              </Field>
              <Field label="Server IP or hostname">
                <Input name="host" required placeholder="127.0.0.1" />
              </Field>
              <Field label="Game port">
                <Input name="gamePort" type="number" required defaultValue={28015} min={1} max={65535} />
              </Field>
              <Field label="RCON port">
                <Input name="rconPort" type="number" required defaultValue={28016} min={1} max={65535} />
              </Field>
              <Field label="RCON type">
                <Select name="rconType" defaultValue="WEBRCON">
                  <option value="WEBRCON">WebRCON</option>
                  <option value="EXPERIMENTAL">Experimental</option>
                  <option value="LEGACY">Legacy</option>
                </Select>
              </Field>
              <Field label="RCON password">
                <Input name="rconPassword" type="password" required autoComplete="off" />
              </Field>
            </div>

            {message ? (
              <div className={`rounded-md border px-3 py-2 text-sm ${connectionOk === false ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>
                {message}
              </div>
            ) : null}

            <Button disabled={busy} className="w-full sm:w-auto">
              {busy ? "Saving..." : "Test Connection and Open Dashboard"}
            </Button>
          </form>
          )}
        </Panel>
      </div>
    </main>
  );
}
