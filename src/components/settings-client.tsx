"use client";

import { useState } from "react";
import { Brain, Download, KeyRound, Save, Trash2, Upload } from "lucide-react";
import { Button, Field, Input, Panel } from "@/components/ui";
import { api } from "@/lib/utils";

type AiSettings = {
  hasApiKey: boolean;
  model: string;
};

export function SettingsClient({ initialAi }: { initialAi: AiSettings }) {
  const [settings, setSettings] = useState(initialAi);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initialAi.model || "gpt-5.5");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Backup & transfer
  const [exportPass, setExportPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  async function exportSetup() {
    if (exportPass.trim().length < 6) { setNotice("Export passphrase must be at least 6 characters."); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await fetch("/api/setup/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passphrase: exportPass }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "myrcon-setup.myrcon";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setExportPass("");
      setNotice("Backup exported. Move the file to your other machine and import it there.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export failed");
    } finally { setBusy(false); }
  }

  async function importSetup() {
    if (!importFile) { setNotice("Choose a backup file to import."); return; }
    if (!importPass.trim()) { setNotice("Enter the backup passphrase."); return; }
    setBusy(true); setNotice(null);
    try {
      const backup = await importFile.text();
      const data = await api<{ imported: number; skipped: number }>("/api/setup/import", { method: "POST", body: JSON.stringify({ backup, passphrase: importPass }) });
      setImportPass(""); setImportFile(null);
      setNotice(`Imported ${data.imported} server(s)${data.skipped ? `, ${data.skipped} skipped (duplicates)` : ""}. Check the Servers page.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  async function save(clearApiKey = false) {
    setBusy(true);
    setNotice(null);
    try {
      const next = await api<AiSettings>("/api/settings/ai", {
        method: "PATCH",
        body: JSON.stringify({
          apiKey: clearApiKey ? null : apiKey,
          model,
          clearApiKey,
        }),
      });
      setSettings(next);
      setApiKey("");
      setNotice(clearApiKey ? "OpenAI API key removed." : "AI settings saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save AI settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Instance-level configuration for this MyRcon install.</p>
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
              <Brain className="h-4 w-4" /> Optional AI
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">OpenAI Plugin Analysis</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Add your own OpenAI API key to enable AI suggestions on installed `.cs` plugins. The key is encrypted locally and never shown again after saving.
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <span className="text-slate-500">Status: </span>
            <span className={settings.hasApiKey ? "font-semibold text-emerald-300" : "font-semibold text-yellow-200"}>
              {settings.hasApiKey ? "API key saved" : "Not configured"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_16rem]">
          <Field label="OpenAI API key" hint={settings.hasApiKey ? "Leave blank to keep the saved key. Paste a new key to replace it." : "Paste your own OpenAI API key."}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={settings.hasApiKey ? "Saved key hidden" : "sk-..."}
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Model">
            <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5.5" />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => save(false)} disabled={busy || (!apiKey.trim() && model === settings.model)}>
            <Save className="h-4 w-4" />Save AI Settings
          </Button>
          <Button variant="danger" onClick={() => save(true)} disabled={busy || !settings.hasApiKey}>
            <Trash2 className="h-4 w-4" />Clear Key
          </Button>
        </div>

        <div className="mt-5 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
          Plugin source is only sent to OpenAI when an authenticated user clicks <span className="font-semibold text-slate-200">Analyze .cs</span>. RCON passwords, SFTP passwords, and private keys are never sent.
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold text-white">Backup &amp; Transfer</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Move your whole setup to another machine (e.g. Windows → Mac) without retyping. Export a passphrase-encrypted
          backup here, then import it on the other machine&apos;s setup screen or here in Settings.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Download className="h-4 w-4 text-emerald-400" />Export</div>
            <p className="mt-1 text-xs text-slate-500">Includes server profiles and their RCON/SFTP credentials, encrypted with your passphrase. Keep the file private.</p>
            <div className="mt-3 grid gap-3">
              <Field label="Passphrase" hint="At least 6 characters. You&apos;ll need this to import.">
                <Input type="password" value={exportPass} onChange={(e) => setExportPass(e.target.value)} />
              </Field>
              <Button onClick={exportSetup} disabled={busy}><Download className="h-4 w-4" />Export Backup</Button>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Upload className="h-4 w-4 text-emerald-400" />Import</div>
            <p className="mt-1 text-xs text-slate-500">Restores servers from a backup. Profiles with the same name + host are skipped.</p>
            <div className="mt-3 grid gap-3">
              <Field label="Backup file (.myrcon)">
                <input type="file" accept=".myrcon,application/octet-stream,text/plain" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white" />
              </Field>
              <Field label="Passphrase"><Input type="password" value={importPass} onChange={(e) => setImportPass(e.target.value)} /></Field>
              <Button onClick={importSetup} disabled={busy || !importFile}><Upload className="h-4 w-4" />Import Backup</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
