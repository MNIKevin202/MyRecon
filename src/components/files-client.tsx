"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Copy,
  File,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

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

type SortKey = "name" | "size" | "modified";
type SortDir = "asc" | "desc";

function joinPath(dir: string, name: string) {
  return `${dir.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
}

function formatSize(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function breadcrumbs(path: string) {
  const clean = path.replace(/\\/g, "/");
  const parts = clean.split("/").filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    crumbs.push({ label: parts[i], path: "/" + parts.slice(0, i + 1).join("/") });
  }
  return crumbs;
}

function fileIcon(entry: Entry) {
  if (entry.type === "directory") return <Folder className="h-4 w-4 shrink-0 text-orange-300" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  if (["cs", "js", "ts", "json", "cfg", "ini", "txt", "log", "xml", "yaml", "yml"].includes(ext)) {
    return <FileText className="h-4 w-4 shrink-0 text-blue-300" />;
  }
  return <File className="h-4 w-4 shrink-0 text-slate-400" />;
}

export function FilesClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const selected = useMemo(() => servers.find((s) => s.id === serverId), [serverId, servers]);

  const [currentPath, setCurrentPath] = useState(defaultServer?.sftpRootPath ?? "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<SftpError | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (path: string) => {
    if (!serverId) return;
    setBusy(true);
    setError(null);
    setFilter("");
    try {
      const data = await api<{ path: string; entries: Entry[] }>(
        `/api/servers/${serverId}/sftp/list?path=${encodeURIComponent(path)}`,
      );
      setCurrentPath(data.path);
      setEntries(data.entries);
    } catch (err) {
      const e = err as Error & { details?: SftpError };
      setError(e.details ?? null);
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (!selected?.sftpRootPath) return;
    const path = selected.sftpRootPath;
    const timer = window.setTimeout(() => {
      setCurrentPath(path);
      void load(path);
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.sftpRootPath]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const dirs = entries.filter((e) => e.type === "directory");
    const files = entries.filter((e) => e.type === "file");

    function cmp(a: Entry, b: Entry) {
      let result = 0;
      if (sortKey === "name") result = a.name.localeCompare(b.name);
      else if (sortKey === "size") result = a.size - b.size;
      else result = a.modifyTime - b.modifyTime;
      return sortDir === "asc" ? result : -result;
    }

    const filtered = (list: Entry[]) =>
      list.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase())).sort(cmp);

    return [...filtered(dirs), ...filtered(files)];
  }, [entries, filter, sortKey, sortDir]);

  async function readFile(path: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ path: string; tooLarge: boolean; content: string }>(
        `/api/servers/${serverId}/sftp/read`,
        { method: "POST", body: JSON.stringify({ path }) },
      );
      if (data.tooLarge) {
        setNotice("File is too large to edit in-browser.");
        return;
      }
      setEditingPath(data.path);
      setEditorContent(data.content);
    } catch (err) {
      const e = err as Error & { details?: SftpError };
      setError(e.details ?? null);
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFile() {
    if (!editingPath) return;
    setEditorBusy(true);
    try {
      await api(`/api/servers/${serverId}/sftp/write`, {
        method: "POST",
        body: JSON.stringify({ path: editingPath, content: editorContent }),
      });
      setNotice("File saved.");
      await load(currentPath);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setEditorBusy(false);
    }
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.set("path", currentPath);
    form.set("file", file);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/sftp/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error ?? "Upload failed"), { details: data.details });
      setNotice(data.pluginHint ?? `Uploaded ${file.name}`);
      await load(currentPath);
    } catch (err) {
      const e = err as Error & { details?: SftpError };
      setError(e.details ?? null);
      setNotice(e.message);
    } finally {
      setBusy(false);
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

  async function createFile() {
    const name = window.prompt("File name");
    if (!name) return;
    const path = joinPath(currentPath, name);
    await api(`/api/servers/${serverId}/sftp/write`, {
      method: "POST",
      body: JSON.stringify({ path, content: "" }),
    });
    await readFile(path);
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete ${entry.name}?`)) return;
    await api(`/api/servers/${serverId}/sftp/delete`, {
      method: "POST",
      body: JSON.stringify({ path: entry.path }),
    });
    await load(currentPath);
  }

  async function rename(entry: Entry) {
    const newPath = window.prompt("New path", entry.path);
    if (!newPath || newPath === entry.path) return;
    await api(`/api/servers/${serverId}/sftp/rename`, {
      method: "POST",
      body: JSON.stringify({ oldPath: entry.path, newPath }),
    });
    await load(currentPath);
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    if (!dropRef.current?.contains(event.relatedTarget as Node)) setDragging(false);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  const crumbs = breadcrumbs(currentPath);

  const quickPaths = [
    { label: "Root", path: selected?.sftpRootPath },
    { label: "Carbon Plugins", path: selected?.sftpDefaultPluginPath },
    { label: "Carbon Config", path: selected?.sftpDefaultConfigPath },
    { label: "Oxide Plugins", path: selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "oxide/plugins") : null },
    { label: "Oxide Config", path: selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "oxide/config") : null },
    { label: "Server Config", path: selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "server") : null },
    { label: "Logs", path: selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "logs") : null },
    { label: "Backups", path: selected?.sftpRootPath ? joinPath(selected.sftpRootPath, "backups") : null },
  ].filter((q) => !!q.path) as { label: string; path: string }[];

  return (
    <div className="grid min-w-0 gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Files</h1>
          <p className="mt-1 text-sm text-slate-400">Manage Rust server files over SFTP or FTP.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(e) => setServerId(e.target.value)} className="min-w-56">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => load(currentPath)} disabled={busy}>
            <RefreshCw className={clsx("h-4 w-4", busy && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>

      {!selected?.sftpEnabled ? (
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">SFTP is not enabled for this server</h2>
              <p className="mt-1 text-sm text-slate-400">Go to Servers, edit this profile, and enable SFTP.</p>
            </div>
            <Link className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]" href="/servers">
              Open Servers
            </Link>
          </div>
        </Panel>
      ) : null}

      {notice ? (
        <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-3 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {error ? (
        <Panel className="border-red-500/30 bg-red-500/10">
          <div className="flex justify-between gap-4">
            <div>
              <div className="font-semibold text-red-100">SFTP {error.operation} failed</div>
              <div className="mt-1 text-sm text-red-100">{error.message}</div>
              <details className="mt-2 text-xs text-red-100/80">
                <summary>Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">{[
                  `Server: ${error.serverName}`,
                  `Host: ${error.host}:${error.port}`,
                  error.requestedPath ? `Path: ${error.requestedPath}` : null,
                  `Operation: ${error.operation}`,
                  `Error: ${error.message}`,
                ].filter(Boolean).join("\n")}</pre>
              </details>
            </div>
            <button onClick={() => setError(null)} className="shrink-0 text-red-200 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* Bookmarks sidebar */}
        <div className="grid gap-1 self-start">
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bookmarks</div>
          {quickPaths.map((q) => (
            <button
              key={q.label}
              onClick={() => load(q.path)}
              className={clsx(
                "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-white/[0.06]",
                currentPath === q.path ? "bg-orange-500/15 text-orange-100" : "text-slate-400",
              )}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              {q.label}
            </button>
          ))}
        </div>

        {/* Main file browser */}
        <div className="grid gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/[0.06]">
              <Upload className="h-4 w-4" />Upload
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
            </label>
            <Button variant="secondary" onClick={createFolder}><FolderPlus className="h-4 w-4" />New Folder</Button>
            <Button variant="secondary" onClick={createFile}><FilePlus className="h-4 w-4" />New File</Button>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="ml-auto max-w-48" />
          </div>

          {/* Breadcrumb */}
          <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <button onClick={() => load("/")} className="shrink-0 text-slate-400 hover:text-orange-300">/</button>
            {crumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                <button
                  onClick={() => load(crumb.path)}
                  className={clsx("hover:text-orange-300", i === crumbs.length - 1 ? "text-white" : "text-slate-400")}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            <button
              onClick={() => navigator.clipboard.writeText(currentPath)}
              className="ml-auto shrink-0 text-slate-500 hover:text-slate-300"
              title="Copy path"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* File table */}
          <div
            ref={dropRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={clsx(
              "relative min-h-64 overflow-hidden rounded-md border transition",
              dragging ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/20",
            )}
          >
            {dragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-orange-300">
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">Drop to upload</span>
                </div>
              </div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_160px_100px] gap-2 border-b border-white/10 px-4 py-2">
              {(["name", "size", "modified"] as const).map((col) => (
                <button
                  key={col}
                  onClick={() => toggleSort(col)}
                  className={clsx("flex items-center gap-1 text-xs font-semibold uppercase tracking-wide", sortKey === col ? "text-orange-300" : "text-slate-500 hover:text-slate-300")}
                >
                  {col === "name" ? "Name" : col === "size" ? "Size" : "Modified"}
                  {sortKey === col && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              ))}
              <div />
            </div>

            {sorted.length === 0 && !busy && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {filter ? "No files match the filter." : "This folder is empty."}
              </div>
            )}

            {sorted.map((entry) => (
              <div
                key={entry.path}
                className="group grid grid-cols-[1fr_80px_160px_100px] items-center gap-2 border-b border-white/[0.04] px-4 py-2 last:border-0 hover:bg-white/[0.04]"
              >
                <button
                  className="flex min-w-0 items-center gap-2 text-left"
                  onClick={() => entry.type === "directory" ? load(entry.path) : readFile(entry.path)}
                >
                  {fileIcon(entry)}
                  <span className="truncate text-sm text-slate-100">{entry.name}</span>
                </button>
                <span className="text-xs text-slate-500">
                  {entry.type === "directory" ? "—" : formatSize(entry.size)}
                </span>
                <span className="text-xs text-slate-500">{formatDate(entry.modifyTime)}</span>
                <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                  {entry.type === "file" && (
                    <button onClick={() => readFile(entry.path)} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" title="Edit file">
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => rename(entry)} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" title="Rename">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(entry)} className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-300" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div className="text-xs text-slate-500">
            {sorted.length} item{sorted.length !== 1 ? "s" : ""}
            {filter ? ` matching "${filter}"` : ""}
            {" "}· {currentPath}
          </div>
        </div>
      </div>

      {/* File editor overlay */}
      {editingPath && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#090b10]">
          {/* Editor toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0c1017] px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-orange-300" />
              <span className="truncate text-sm font-medium text-white">{editingPath}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={saveFile} disabled={editorBusy}>
                <Save className="h-4 w-4" />{editorBusy ? "Saving…" : "Save"}
              </Button>
              <button
                onClick={() => setEditingPath(null)}
                className="ml-1 rounded-md p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                title="Close editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Editor body */}
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="min-h-0 flex-1 resize-none bg-[#060809] p-6 font-mono text-sm leading-6 text-slate-100 outline-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
