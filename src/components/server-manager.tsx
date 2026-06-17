"use client";

import { useState } from "react";
import { Check, Copy, Download, Pencil, Plus, Power, Star, Trash2 } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  modFramework: string;
  sftpEnabled: boolean;
  sftpProtocol: string;
  sftpHost: string | null;
  sftpPort: number;
  sftpUsername: string | null;
  sftpRootPath: string | null;
  sftpDefaultPluginPath: string | null;
  sftpDefaultConfigPath: string | null;
  sftpAllowOutsideRoot: boolean;
  notes: string | null;
  isDefault: boolean;
};

const blank = {
  name: "",
  host: "",
  gamePort: 28015,
  rconPort: 28016,
  rconType: "WEBRCON",
  rconPassword: "",
  notes: "",
  modFramework: "oxide",
  sftpEnabled: false,
  sftpProtocol: "SFTP",
  sftpHost: "",
  sftpPort: 22,
  sftpUsername: "",
  sftpPassword: "",
  sftpPrivateKey: "",
  sftpRootPath: "",
  sftpDefaultPluginPath: "",
  sftpDefaultConfigPath: "",
  sftpAllowOutsideRoot: false,
};

type Tab = "saved" | "add" | "copy";

export function ServerManager({ initialServers }: { initialServers: Server[] }) {
  const [servers, setServers] = useState(initialServers);
  const [tab, setTab] = useState<Tab>("saved");
  const [editing, setEditing] = useState<Server | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Copy Plugins tab state
  const [copySource, setCopySource] = useState("");
  const [copyTarget, setCopyTarget] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyLogs, setCopyLogs] = useState<string[]>([]);

  async function copyPlugins() {
    if (!copySource || !copyTarget) {
      setMessage("Choose both a source and a target server.");
      return;
    }
    if (copySource === copyTarget) {
      setMessage("Source and target must be different servers.");
      return;
    }
    setCopyBusy(true);
    setCopyLogs([]);
    setMessage(null);
    try {
      const data = await api<{ success: boolean; copied: string[]; failed: string[]; logs: string[] }>(
        `/api/servers/${copySource}/copy-plugins`,
        { method: "POST", body: JSON.stringify({ targetServerId: copyTarget }) },
      );
      setCopyLogs(data.logs ?? []);
      setMessage(
        data.success
          ? `Copied ${data.copied.length} plugin(s) successfully.`
          : `Finished with ${data.failed.length} failure(s) — see log below.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setCopyBusy(false);
    }
  }

  async function downloadZip() {
    if (!copySource) {
      setMessage("Choose a source server to download its plugins.");
      return;
    }
    setCopyBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/servers/${copySource}/plugins-zip`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "myrcon-plugins.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${filename}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed");
    } finally {
      setCopyBusy(false);
    }
  }

  function update(key: keyof typeof blank, value: string | number | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(server: Server) {
    setEditing(server);
    setForm({
      name: server.name,
      host: server.host,
      gamePort: server.gamePort,
      rconPort: server.rconPort,
      rconType: server.rconType,
      rconPassword: "",
      notes: server.notes ?? "",
      modFramework: server.modFramework ?? "oxide",
      sftpEnabled: server.sftpEnabled,
      sftpProtocol: server.sftpProtocol ?? "SFTP",
      sftpHost: server.sftpHost ?? "",
      sftpPort: server.sftpPort,
      sftpUsername: server.sftpUsername ?? "",
      sftpPassword: "",
      sftpPrivateKey: "",
      sftpRootPath: server.sftpRootPath ?? "",
      sftpDefaultPluginPath: server.sftpDefaultPluginPath ?? "",
      sftpDefaultConfigPath: server.sftpDefaultConfigPath ?? "",
      sftpAllowOutsideRoot: server.sftpAllowOutsideRoot,
    });
    setMessage(null);
    setTab("add");
  }

  function cancelEdit() {
    setEditing(null);
    setForm(blank);
    setMessage(null);
    setTab("saved");
  }

  async function reload() {
    const data = await api<{ servers: Server[] }>("/api/servers");
    setServers(data.servers);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const payload = { ...form };
      const path = editing ? `/api/servers/${editing.id}` : "/api/servers";
      const method = editing ? "PATCH" : "POST";
      if (editing && !payload.rconPassword) {
        delete (payload as Partial<typeof payload>).rconPassword;
      }
      await api(path, { method, body: JSON.stringify(payload) });
      setForm(blank);
      setEditing(null);
      await reload();
      setMessage("Server profile saved.");
      setTab("saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(server: Server) {
    if (!window.confirm(`Delete ${server.name}?`)) return;
    await api(`/api/servers/${server.id}`, { method: "DELETE" });
    await reload();
  }

  async function makeDefault(server: Server) {
    await api(`/api/servers/${server.id}/default`, { method: "POST" });
    await reload();
  }

  async function test(server: Server) {
    setMessage(`Testing ${server.name}...`);
    try {
      const data = await api<{ status: { online: boolean; raw?: string } }>(`/api/servers/${server.id}/test`, { method: "POST" });
      setMessage(data.status.online ? `${server.name} responded.` : `${server.name} is offline or unavailable.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed");
    }
  }

  async function reboot(server: Server) {
    if (!window.confirm(`Reboot ${server.name}? The server process will restart.`)) return;
    setMessage(`Reboot command sent to ${server.name} — server will restart shortly.`);
    try {
      await api(`/api/servers/${server.id}/console`, { method: "POST", body: JSON.stringify({ command: "quit" }) });
    } catch {
      // quit disconnects the server before it can reply — treat any network/timeout error as success
    }
  }

  async function saveSftp(forceEnabled = false) {
    if (!editing) {
      setMessage("Save the server profile before configuring SFTP.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        modFramework: form.modFramework,
        sftpEnabled: forceEnabled ? true : form.sftpEnabled,
        sftpProtocol: form.sftpProtocol,
        sftpHost: form.sftpHost,
        sftpPort: form.sftpPort,
        sftpUsername: form.sftpUsername,
        sftpPassword: form.sftpPassword,
        sftpPrivateKey: form.sftpPrivateKey,
        sftpRootPath: form.sftpRootPath,
        sftpDefaultPluginPath: form.sftpDefaultPluginPath,
        sftpDefaultConfigPath: form.sftpDefaultConfigPath,
        sftpAllowOutsideRoot: form.sftpAllowOutsideRoot,
      };
      if (!payload.sftpPassword) delete (payload as Partial<typeof payload>).sftpPassword;
      if (!payload.sftpPrivateKey) delete (payload as Partial<typeof payload>).sftpPrivateKey;
      await api(`/api/servers/${editing.id}/sftp/settings`, { method: "PATCH", body: JSON.stringify(payload) });
      if (forceEnabled) {
        setForm((current) => ({ ...current, sftpEnabled: true }));
      }
      await reload();
      setMessage("SFTP settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SFTP save failed");
    } finally {
      setBusy(false);
    }
  }

  async function testSftp() {
    if (!editing) {
      setMessage("Save the server profile before testing SFTP.");
      return;
    }
    setMessage("Testing SFTP...");
    try {
      await saveSftp(true);
      const result = await api<{ ok: boolean; path: string }>(`/api/servers/${editing.id}/sftp/test`, { method: "POST" });
      setMessage(`SFTP connected. Root: ${result.path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SFTP test failed");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "saved", label: "Saved Servers" },
    { id: "add", label: editing ? "Edit Server" : "Add a Server" },
    { id: "copy", label: "Copy Plugins" },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Servers</h1>
        <p className="mt-1 text-sm text-slate-400">Create and maintain unlimited Rust server profiles.</p>
      </div>

      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === "saved" && editing) cancelEdit();
              else setTab(t.id);
            }}
            className={clsx(
              "px-5 py-2.5 text-sm font-medium transition",
              tab === t.id
                ? "border-b-2 border-orange-400 text-orange-100"
                : "text-slate-400 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      {tab === "saved" && (
        <div className="grid gap-3">
          {servers.length === 0 ? (
            <p className="text-sm text-slate-500">No servers yet. Use the <button className="text-orange-300 underline" onClick={() => setTab("add")}>Add a Server</button> tab to get started.</p>
          ) : null}
          {servers.map((server) => (
            <Panel key={server.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{server.name}</h3>
                    {server.isDefault ? <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs text-orange-100">Default</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {server.host}:{server.gamePort} · RCON {server.rconPort} · {server.rconType}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => test(server)}><Check className="h-4 w-4" />Test</Button>
                  <Button variant="secondary" onClick={() => startEdit(server)}><Pencil className="h-4 w-4" />Edit</Button>
                  <Button variant="secondary" onClick={() => makeDefault(server)}><Star className="h-4 w-4" />Default</Button>
                  <Button variant="danger" onClick={() => reboot(server)}><Power className="h-4 w-4" />Reboot</Button>
                  <Button variant="danger" onClick={() => remove(server)}><Trash2 className="h-4 w-4" />Delete</Button>
                </div>
              </div>
            </Panel>
          ))}
          <div className="pt-2">
            <Button onClick={() => setTab("add")}><Plus className="h-4 w-4" />Add a Server</Button>
          </div>
        </div>
      )}

      {tab === "add" && (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-300" />
              <h2 className="text-lg font-semibold">{editing ? "Edit server" : "Add server"}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Server name">
                <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
              </Field>
              <Field label="Host">
                <Input value={form.host} onChange={(event) => update("host", event.target.value)} />
              </Field>
              <Field label="Game port">
                <Input type="number" value={form.gamePort} onChange={(event) => update("gamePort", Number(event.target.value))} />
              </Field>
              <Field label="RCON port">
                <Input type="number" value={form.rconPort} onChange={(event) => update("rconPort", Number(event.target.value))} />
              </Field>
              <Field label="RCON type">
                <Select value={form.rconType} onChange={(event) => update("rconType", event.target.value)}>
                  <option value="WEBRCON">WebRCON</option>
                  <option value="EXPERIMENTAL">Experimental</option>
                  <option value="LEGACY">Legacy</option>
                </Select>
              </Field>
              <Field label="RCON password" hint={editing ? "Leave blank to keep the existing encrypted password." : undefined}>
                <Input type="password" value={form.rconPassword} onChange={(event) => update("rconPassword", event.target.value)} />
              </Field>
              <Field label="Notes">
                <Input value={form.notes} onChange={(event) => update("notes", event.target.value)} />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save server"}</Button>
              <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold text-white">File Access (SFTP / FTP)</h2>
            <p className="mt-1 text-sm text-slate-400">Credentials are encrypted and never returned after saving.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.sftpEnabled} onChange={(event) => update("sftpEnabled", event.target.checked)} />
                Enable file access
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!form.sftpAllowOutsideRoot} onChange={(event) => update("sftpAllowOutsideRoot", !event.target.checked)} />
                Lock browsing to root path
              </label>
              <Field label="Protocol" hint="Use FTP for hosts that don't offer SFTP (e.g. HostHavoc).">
                <Select
                  value={form.sftpProtocol}
                  onChange={(event) => {
                    const next = event.target.value;
                    update("sftpProtocol", next);
                    // Switch to the protocol's standard port if still on the other default
                    if (next === "FTP" && form.sftpPort === 22) update("sftpPort", 21);
                    if (next === "SFTP" && form.sftpPort === 21) update("sftpPort", 22);
                  }}
                >
                  <option value="SFTP">SFTP (SSH)</option>
                  <option value="FTP">FTP</option>
                </Select>
              </Field>
              <Field label="Port">
                <Input type="number" value={form.sftpPort} onChange={(event) => update("sftpPort", Number(event.target.value))} />
              </Field>
              <Field label="Host">
                <Input value={form.sftpHost} onChange={(event) => update("sftpHost", event.target.value)} placeholder="147.189.174.244" />
              </Field>
              <Field label="Username">
                <Input value={form.sftpUsername} onChange={(event) => update("sftpUsername", event.target.value)} />
              </Field>
              <Field label="Password" hint="Leave blank to keep the saved password.">
                <Input type="password" value={form.sftpPassword} onChange={(event) => update("sftpPassword", event.target.value)} />
              </Field>
              {form.sftpProtocol !== "FTP" && (
                <Field label="Private key" hint="Optional. Leave blank to keep the saved key.">
                  <textarea className="min-h-24 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-100 outline-none focus:border-orange-400" value={form.sftpPrivateKey} onChange={(event) => update("sftpPrivateKey", event.target.value)} />
                </Field>
              )}
              <Field label="Mod framework" hint="Determines the default plugin install path when no override is set.">
                <Select value={form.modFramework} onChange={(event) => update("modFramework", event.target.value)}>
                  <option value="oxide">Oxide</option>
                  <option value="carbon">Carbon</option>
                </Select>
              </Field>
              <Field label="Root path">
                <Input value={form.sftpRootPath} onChange={(event) => update("sftpRootPath", event.target.value)} placeholder="C:/rustserver" />
              </Field>
              <Field label="Plugin path override" hint="Leave blank to use the default based on Mod framework above.">
                <Input value={form.sftpDefaultPluginPath} onChange={(event) => update("sftpDefaultPluginPath", event.target.value)} placeholder={form.modFramework === "carbon" ? "C:/rustserver/carbon/plugins" : "C:/rustserver/oxide/plugins"} />
              </Field>
              <Field label="Config path override">
                <Input value={form.sftpDefaultConfigPath} onChange={(event) => update("sftpDefaultConfigPath", event.target.value)} placeholder={form.modFramework === "carbon" ? "C:/rustserver/carbon/config" : "C:/rustserver/oxide/config"} />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => saveSftp()} disabled={busy}>Save SFTP</Button>
              <Button variant="secondary" onClick={testSftp} disabled={busy}>Test SFTP Connection</Button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "copy" && (
        <Panel className="max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <Copy className="h-5 w-5 text-orange-300" />
            <h2 className="text-lg font-semibold">Copy Installed Plugins</h2>
          </div>
          <p className="mb-5 text-sm text-slate-400">
            Copy <em>all</em> plugins (MyRcon + uMod/Oxide) from the source server to the target
            server via SFTP — both must have SFTP enabled — or download them as a ZIP to install
            yourself. The target server auto-loads the new plugins.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From (source)">
              <Select value={copySource} onChange={(event) => setCopySource(event.target.value)}>
                <option value="">Select a server…</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="To (target)" hint="Must have SFTP enabled.">
              <Select value={copyTarget} onChange={(event) => setCopyTarget(event.target.value)}>
                <option value="">Select a server…</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.sftpEnabled}>
                    {s.name}{s.sftpEnabled ? "" : " (SFTP off)"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={copyPlugins}
              disabled={copyBusy || !copySource || !copyTarget || !servers.find((s) => s.id === copySource)?.sftpEnabled}
            >
              <Copy className="h-4 w-4" />
              {copyBusy ? "Copying…" : "Copy Plugins"}
            </Button>
            <Button
              variant="secondary"
              onClick={downloadZip}
              disabled={copyBusy || !copySource || !servers.find((s) => s.id === copySource)?.sftpEnabled}
            >
              <Download className="h-4 w-4" />
              Download ZIP
            </Button>
          </div>
          {copySource && !servers.find((s) => s.id === copySource)?.sftpEnabled && (
            <p className="mt-2 text-xs text-amber-500/80">
              The source server needs SFTP enabled to copy or download its plugins.
            </p>
          )}
          {copyLogs.length > 0 && (
            <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-300">
              {copyLogs.join("\n")}
            </pre>
          )}
        </Panel>
      )}
    </div>
  );
}
