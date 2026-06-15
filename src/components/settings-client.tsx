"use client";

import { useState } from "react";
import { Brain, KeyRound, Save, Trash2 } from "lucide-react";
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
    </div>
  );
}
