"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, FileText, Folder, RefreshCw, Save, Upload } from "lucide-react";
import { Button, Input, Panel, Select } from "@/components/ui";
import { api } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  isDefault: boolean;
  sftpEnabled: boolean;
  sftpRootPath: string | null;
  sftpDefaultPluginPath: string | null;
  sftpDefaultConfigPath: string | null;
};

type Entry = {
  name: string;
  type: "file" | "directory";
  size: number;
  modifyTime: number;
  path: string;
};

type SftpError = {
  timestamp: string;
  serverName: string;
  host: string;
  port: number;
  username: string;
  requestedPath?: string;
  operation: string;
  message: string;
  stack?: string;
};

function parentPath(path: string) {
  const clean = path.replace(/\\/g, "/").replace(/\/$/, "");
  const index = clean.lastIndexOf("/");
  if (index <= 0) return clean;
  return clean.slice(0, index);
}

function joinPath(dir: string, name: string) {
  return `${dir.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
}

export function FilesClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const selected = useMemo(() => servers.find((server) => server.id === serverId), [serverId, servers]);
  const [currentPath, setCurrentPath] = useState(defaultServer?.sftpRootPath ?? "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<SftpError | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (path = currentPath) => {
    if (!serverId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ path: string; entries: Entry[] }>(`/api/servers/${serverId}/sftp/list?path=${encodeURIComponent(path)}`);
      setCurrentPath(data.path);
      setEntries(data.entries);
    } catch (err) {
      const apiError = err as Error & { details?: SftpError };
      setError(apiError.details ?? null);
      setNotice(apiError.message);
    } finally {
      setBusy(false);
    }
  }, [serverId, currentPath]);

  useEffect(() => {
    if (!selected?.sftpRootPath) return;
    const targetPath = selected.sftpRootPath;
    const timer = window.setTimeout(() => {
      setCurrentPath(targetPath);
      void load(targetPath);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected?.id, selected?.sftpRootPath, load]);

  const filtered = entries.filter((entry) => entry.name.toLowerCase().includes(filter.toLowerCase()));

  function errorText(details: SftpError) {
    return [
      `Timestamp: ${details.timestamp}`,
      `Server: ${details.serverName}`,
      `SFTP host: ${details.host}`,
      `SFTP port: ${details.port}`,
      `Username: ${details.username}`,
      details.requestedPath ? `Requested path: ${details.requestedPath}` : null,
      `Operation: ${details.operation}`,
      `Error: ${details.message}`,
      details.stack ? `Stack:\n${details.stack}` : null,
    ].filter(Boolean).join("\n");
  }

  async function copyError() {
    if (!error) return;
    await navigator.clipboard.writeText(errorText(error));
    setNotice("SFTP error copied");
  }

  async function readFile(path: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ path: string; tooLarge: boolean; size: number; content: string }>(`/api/servers/${serverId}/sftp/read`, {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      if (data.tooLarge) {
        setNotice("This file is large. Download instead?");
        return;
      }
      setEditingPath(data.path);
      setEditorContent(data.content);
    } catch (err) {
      const apiError = err as Error & { details?: SftpError };
      setError(apiError.details ?? null);
      setNotice(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFile() {
    if (!editingPath) return;
    await api(`/api/servers/${serverId}/sftp/write`, {
      method: "POST",
      body: JSON.stringify({ path: editingPath, content: editorContent }),
    });
    setNotice("File saved");
    await load(currentPath);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("path", currentPath);
    form.set("file", file);
    try {
      const result = await fetch(`/api/servers/${serverId}/sftp/upload`, { method: "POST", body: form });
      const data = await result.json();
      if (!result.ok) throw Object.assign(new Error(data.error ?? "Upload failed"), { details: data.details });
      setNotice(data.pluginHint ?? "File uploaded");
      await load(currentPath);
    } catch (err) {
      const apiError = err as Error & { details?: SftpError };
      setError(apiError.details ?? null);
      setNotice(apiError.message);
    }
  }

  async function createFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;
    await api(`/api/servers/${serverId}/sftp/mkdir`, {
      method: "POST",
      body: JSON.stringify({ path: joinPath(currentPath, name) }),
    });
    await load(currentPath);
  }

  async function createTextFile() {
    const name = window.prompt("File name");
    if (!name) return;
    const path = joinPath(currentPath, name);
    await api(`/api/servers/${serverId}/sftp/write`, {
      method: "POST",
      body: JSON.stringify({ path, content: "" }),
    });
    await readFile(path);
  }

  async function remove(path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    await api(`/api/servers/${serverId}/sftp/delete`, {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    await load(currentPath);
  }

  async function rename(path: string) {
    const newPath = window.prompt("New path", path);
    if (!newPath || newPath === path) return;
    await api(`/api/servers/${serverId}/sftp/rename`, {
      method: "POST",
      body: JSON.stringify({ oldPath: path, newPath }),
    });
    await load(currentPath);
  }

  async function runCommand(command: string) {
    await api(`/api/servers/${serverId}/console`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    setNotice(`Ran ${command}`);
  }

  const quickPaths = [
    ["Root", selected?.sftpRootPath],
    ["Carbon Plugins", selected?.sftpDefaultPluginPath],
    ["Carbon Config", selected?.sftpDefaultConfigPath],
    ["Oxide Plugins", selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "oxide/plugins") : ""],
    ["Oxide Config", selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "oxide/config") : ""],
    ["Server Config", selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "server") : ""],
    ["Logs", selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "logs") : ""],
    ["Backups", selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "backups") : ""],
  ] as const;

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Files</h1>
          <p className="mt-1 text-sm text-slate-400">Manage Rust server files over server-side SFTP.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => setServerId(event.target.value)} className="min-w-56">
            {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => load(currentPath)} disabled={busy}><RefreshCw className="h-4 w-4" />Refresh</Button>
        </div>
      </div>

      {!selected?.sftpEnabled ? (
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">SFTP is disabled in this MyRcon profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                FileZilla can still work while MyRcon is disabled. Edit this server, check Enable SFTP, then Save SFTP or Test SFTP Connection.
              </p>
            </div>
            <Link className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]" href="/servers">
              Open Servers
            </Link>
          </div>
        </Panel>
      ) : null}
      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}
      {error ? (
        <Panel className="border-red-500/30 bg-red-500/10">
          <div className="flex justify-between gap-4">
            <div>
              <div className="font-semibold text-red-100">SFTP {error.operation} failed</div>
              <div className="mt-1 text-sm text-red-100">{error.message}</div>
              <details className="mt-2 text-xs text-red-100/80"><summary>Technical details</summary><pre className="mt-2 whitespace-pre-wrap break-words">{errorText(error)}</pre></details>
            </div>
            <Button variant="secondary" onClick={copyError}><Copy className="h-4 w-4" />Copy Error</Button>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex flex-wrap gap-2">
          {quickPaths.map(([label, path]) => path ? <Button key={label} variant="secondary" onClick={() => load(path)}>{label}</Button> : null)}
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 break-words rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">{currentPath}</div>
          <Button variant="secondary" onClick={() => load(parentPath(currentPath))}>Up</Button>
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(currentPath)}><Copy className="h-4 w-4" />Copy Path</Button>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search current folder" className="max-w-sm" />
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-4 text-sm text-slate-100 hover:bg-white/[0.06]">
            <Upload className="h-4 w-4" />
            Upload
            <input type="file" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          </label>
          <Button variant="secondary" onClick={createFolder}>Create Folder</Button>
          <Button variant="secondary" onClick={createTextFile}>New Text File</Button>
          <Button variant="secondary" onClick={() => runCommand("c.plugins")}>c.plugins</Button>
          <Button variant="secondary" onClick={() => runCommand("save")}>save</Button>
        </div>

        <div className="mt-4 grid gap-2">
          {filtered.map((entry) => (
            <div key={entry.path} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-3 md:flex-row md:items-center md:justify-between">
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => entry.type === "directory" ? load(entry.path) : readFile(entry.path)}>
                {entry.type === "directory" ? <Folder className="h-4 w-4 text-orange-300" /> : <FileText className="h-4 w-4 text-slate-300" />}
                <span className="break-all text-sm text-slate-100">{entry.name}</span>
              </button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => rename(entry.path)}>Rename</Button>
                <Button variant="danger" onClick={() => remove(entry.path)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {editingPath ? (
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="break-all text-lg font-semibold text-white">{editingPath}</h2>
            <Button onClick={saveFile}><Save className="h-4 w-4" />Save</Button>
          </div>
          <textarea value={editorContent} onChange={(event) => setEditorContent(event.target.value)} className="mt-4 h-96 w-full resize-y rounded-md border border-white/10 bg-black/40 p-4 font-mono text-sm text-slate-100 outline-none focus:border-orange-400" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runCommand("c.plugins")}>c.plugins</Button>
            <Button variant="secondary" onClick={() => {
              const plugin = window.prompt("Plugin name");
              if (plugin) runCommand(`c.reload ${plugin}`);
            }}>Reload plugin</Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
