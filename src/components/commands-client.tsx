"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  History,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Category = {
  id: string;
  name: string;
  serverId: string | null;
  commands: SavedCommand[];
};

type SavedCommand = {
  id: string;
  label: string;
  command: string;
  dangerous: boolean;
  requiresConfirm: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  createdAt: string;
};

type CommandRun = {
  id: string;
  serverId: string;
  command: string;
  label: string | null;
  output: string | null;
  success: boolean;
  createdAt: string;
  server: { name: string };
};

const emptyCommandForm = {
  label: "",
  command: "",
  categoryId: "",
  dangerous: false,
  requiresConfirm: false,
};

export function CommandsClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [commands, setCommands] = useState<SavedCommand[]>([]);
  const [history, setHistory] = useState<CommandRun[]>([]);

  // UI state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Ad-hoc runner
  const [adHocCommand, setAdHocCommand] = useState("");
  const [lastOutput, setLastOutput] = useState<{ text: string; success: boolean } | null>(null);

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

  // Command form
  const [showCommandForm, setShowCommandForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(null);
  const [commandForm, setCommandForm] = useState(emptyCommandForm);

  // Busy / notice
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  }

  // Data loading
  const loadCategories = useCallback(async () => {
    const data = await api<{ categories: Category[] }>("/api/commands/categories");
    setCategories(data.categories);
  }, []);

  const loadCommands = useCallback(async () => {
    const data = await api<{ commands: SavedCommand[] }>("/api/commands");
    setCommands(data.commands);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!serverId) return;
    const data = await api<{ runs: CommandRun[] }>(`/api/commands/history?serverId=${serverId}`);
    setHistory(data.runs);
  }, [serverId]);

  const loadAll = useCallback(async () => {
    setBusy("load");
    try {
      await Promise.all([loadCategories(), loadCommands()]);
    } finally {
      setBusy(null);
    }
  }, [loadCategories, loadCommands]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (showHistory) void loadHistory();
  }, [showHistory, loadHistory]);

  // Filtered commands
  const visibleCommands = useMemo(() => {
    return commands.filter((cmd) => {
      const matchesCategory =
        selectedCategoryId === null || cmd.categoryId === selectedCategoryId;
      const matchesSearch =
        !search ||
        [cmd.label, cmd.command]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [commands, selectedCategoryId, search]);

  // Run a command
  async function runCommand(
    command: string,
    label?: string | null,
    savedCommandId?: string | null,
  ) {
    if (!command.trim() || !serverId) return;
    const key = `run-${savedCommandId ?? "adhoc"}`;
    setBusy(key);
    try {
      const result = await api<{ output: string }>("/api/commands/run", {
        method: "POST",
        body: JSON.stringify({
          serverId,
          command,
          label: label ?? null,
          savedCommandId: savedCommandId ?? null,
        }),
      });
      setLastOutput({ text: result.output ?? "Done.", success: true });
      if (showHistory) void loadHistory();
    } catch (error) {
      setLastOutput({
        text: error instanceof Error ? error.message : "Command failed.",
        success: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function runAdHoc() {
    if (!adHocCommand.trim()) return;
    await runCommand(adHocCommand, null, null);
    setAdHocCommand("");
  }

  async function runSaved(cmd: SavedCommand) {
    if (
      cmd.requiresConfirm &&
      !window.confirm(`Run "${cmd.label}"?\n\n${cmd.command}`)
    )
      return;
    if (
      cmd.dangerous &&
      !window.confirm(`⚠ "${cmd.label}" is flagged as dangerous. Run anyway?`)
    )
      return;
    await runCommand(cmd.command, cmd.label, cmd.id);
  }

  // Category CRUD
  async function submitCategory() {
    if (!categoryName.trim()) return;
    setBusy("category");
    try {
      if (editingCategory) {
        await api(`/api/commands/categories/${editingCategory.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: categoryName }),
        });
        flash("Category renamed.");
      } else {
        await api("/api/commands/categories", {
          method: "POST",
          body: JSON.stringify({ name: categoryName }),
        });
        flash("Category created.");
      }
      await loadCategories();
      setCategoryName("");
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCategory(cat: Category) {
    if (
      !window.confirm(
        `Delete category "${cat.name}"? Commands in it will become uncategorized.`,
      )
    )
      return;
    setBusy(`delete-cat-${cat.id}`);
    try {
      await api(`/api/commands/categories/${cat.id}`, { method: "DELETE" });
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
      await loadCategories();
      flash("Category deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  // Command CRUD
  function openAddCommand() {
    setEditingCommand(null);
    setCommandForm({ ...emptyCommandForm, categoryId: selectedCategoryId ?? "" });
    setShowCommandForm(true);
  }

  function openEditCommand(cmd: SavedCommand) {
    setEditingCommand(cmd);
    setCommandForm({
      label: cmd.label,
      command: cmd.command,
      categoryId: cmd.categoryId ?? "",
      dangerous: cmd.dangerous,
      requiresConfirm: cmd.requiresConfirm,
    });
    setShowCommandForm(true);
  }

  async function submitCommand() {
    if (!commandForm.label.trim() || !commandForm.command.trim()) return;
    setBusy("command");
    try {
      const body = {
        label: commandForm.label,
        command: commandForm.command,
        categoryId: commandForm.categoryId || null,
        dangerous: commandForm.dangerous,
        requiresConfirm: commandForm.requiresConfirm,
      };
      if (editingCommand) {
        await api(`/api/commands/${editingCommand.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        flash("Command updated.");
      } else {
        await api("/api/commands", {
          method: "POST",
          body: JSON.stringify(body),
        });
        flash("Command saved.");
      }
      await loadCommands();
      setShowCommandForm(false);
      setEditingCommand(null);
      setCommandForm(emptyCommandForm);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCommand(cmd: SavedCommand) {
    if (!window.confirm(`Delete "${cmd.label}"?`)) return;
    setBusy(`delete-${cmd.id}`);
    try {
      await api(`/api/commands/${cmd.id}`, { method: "DELETE" });
      await loadCommands();
      flash("Command deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const commandCountFor = (catId: string | null) =>
    catId === null
      ? commands.length
      : commands.filter((c) => c.categoryId === catId).length;

  return (
    <div className="grid min-w-0 gap-6">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Commands</h1>
          <p className="mt-1 text-sm text-slate-400">
            Organize saved RCON commands by category, run them on any server, and review history.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="min-w-56"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={loadAll} disabled={busy === "load"}>
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          {notice}
        </div>
      ) : null}

      {/* Ad-hoc runner */}
      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Play className="h-4 w-4 text-orange-400" />
          Run Ad-hoc Command
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={adHocCommand}
            onChange={(e) => setAdHocCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAdHoc();
            }}
            placeholder="e.g. status"
            disabled={!serverId || Boolean(busy)}
          />
          <Button
            onClick={runAdHoc}
            disabled={!adHocCommand.trim() || !serverId || Boolean(busy)}
          >
            <Play className="h-4 w-4" />
            Run
          </Button>
        </div>
        {lastOutput ? (
          <div
            className={clsx(
              "mt-3 rounded-md border p-3 font-mono text-xs",
              lastOutput.success
                ? "border-green-500/20 bg-green-500/10 text-green-100"
                : "border-red-500/30 bg-red-500/10 text-red-100",
            )}
          >
            <div className="mb-1 flex items-center gap-2 font-sans text-xs font-semibold">
              {lastOutput.success ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {lastOutput.success ? "Output" : "Error"}
            </div>
            <pre className="whitespace-pre-wrap">{lastOutput.text}</pre>
          </div>
        ) : null}
      </Panel>

      {/* Categories + Library */}
      <div className="grid gap-4 xl:grid-cols-[16rem_1fr]">
        {/* Categories sidebar */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <FolderOpen className="h-4 w-4 text-orange-400" />
              Categories
            </h2>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingCategory(null);
                setCategoryName("");
                setShowCategoryForm((v) => !v);
              }}
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
          </div>

          {showCategoryForm ? (
            <div className="mb-3 grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3">
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCategory();
                }}
                placeholder={editingCategory ? "New name" : "Category name"}
                autoFocus
                className="h-9 text-xs"
              />
              <div className="flex gap-2">
                <Button
                  onClick={submitCategory}
                  disabled={!categoryName.trim() || busy === "category"}
                  className="h-7 px-2 text-xs"
                >
                  {editingCategory ? "Rename" : "Create"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                    setCategoryName("");
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={clsx(
                "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition",
                selectedCategoryId === null
                  ? "bg-orange-500/15 text-orange-200"
                  : "text-slate-300 hover:bg-white/[0.06]",
              )}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                All Commands
              </span>
              <span className="text-xs text-slate-500">{commandCountFor(null)}</span>
            </button>

            {categories.map((cat) => (
              <div key={cat.id} className="group flex items-center gap-1">
                <button
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={clsx(
                    "flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-sm transition",
                    selectedCategoryId === cat.id
                      ? "bg-orange-500/15 text-orange-200"
                      : "text-slate-300 hover:bg-white/[0.06]",
                  )}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-500">
                    {commandCountFor(cat.id)}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setCategoryName(cat.name);
                    setShowCategoryForm(true);
                  }}
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-200 group-hover:flex"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-red-400 group-hover:flex"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {categories.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No categories yet.</p>
            ) : null}
          </div>
        </Panel>

        {/* Command library */}
        <Panel>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <BookOpen className="h-4 w-4 text-orange-400" />
              Library
              {selectedCategoryId ? (
                <span className="text-sm font-normal text-slate-400">
                  — {categories.find((c) => c.id === selectedCategoryId)?.name}
                </span>
              ) : null}
            </h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <Button onClick={openAddCommand} className="shrink-0">
                <Plus className="h-4 w-4" />
                Add Command
              </Button>
            </div>
          </div>

          {/* Add / Edit form */}
          {showCommandForm ? (
            <div className="mb-4 grid gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  {editingCommand ? "Edit Command" : "New Command"}
                </span>
                <button
                  onClick={() => {
                    setShowCommandForm(false);
                    setEditingCommand(null);
                  }}
                  className="text-slate-500 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label">
                  <Input
                    value={commandForm.label}
                    onChange={(e) =>
                      setCommandForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="e.g. Kick player"
                    autoFocus
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={commandForm.categoryId}
                    onChange={(e) =>
                      setCommandForm((f) => ({ ...f, categoryId: e.target.value }))
                    }
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Command">
                <Input
                  value={commandForm.command}
                  onChange={(e) =>
                    setCommandForm((f) => ({ ...f, command: e.target.value }))
                  }
                  placeholder="e.g. kick {steamId}"
                />
              </Field>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={commandForm.dangerous}
                    onChange={(e) =>
                      setCommandForm((f) => ({ ...f, dangerous: e.target.checked }))
                    }
                  />
                  Flag as dangerous
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={commandForm.requiresConfirm}
                    onChange={(e) =>
                      setCommandForm((f) => ({
                        ...f,
                        requiresConfirm: e.target.checked,
                      }))
                    }
                  />
                  Require confirmation
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={submitCommand}
                  disabled={
                    !commandForm.label.trim() ||
                    !commandForm.command.trim() ||
                    busy === "command"
                  }
                >
                  {editingCommand ? "Update" : "Save Command"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCommandForm(false);
                    setEditingCommand(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {/* Command list */}
          {visibleCommands.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              {search
                ? "No commands match your search."
                : "No saved commands yet. Click Add Command to get started."}
            </p>
          ) : (
            <div className="grid gap-2">
              {visibleCommands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="group rounded-md border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{cmd.label}</span>
                        {cmd.dangerous ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Dangerous
                          </span>
                        ) : null}
                        {cmd.requiresConfirm ? (
                          <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">
                            Confirm required
                          </span>
                        ) : null}
                        {cmd.category ? (
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
                            {cmd.category.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-400">
                        {cmd.command}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        onClick={() => runSaved(cmd)}
                        disabled={!serverId || Boolean(busy)}
                        className="h-7 px-2 text-xs"
                        title="Run on selected server"
                      >
                        <Play className="h-3 w-3" />
                        Run
                      </Button>
                      <button
                        onClick={() => openEditCommand(cmd)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-500 hover:text-slate-200"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteCommand(cmd)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-500 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* History */}
      <Panel>
        <button
          onClick={() => {
            setShowHistory((v) => {
              if (!v) void loadHistory();
              return !v;
            });
          }}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <History className="h-4 w-4 text-orange-400" />
            Recent History
          </h2>
          {showHistory ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showHistory ? (
          <div className="mt-4 grid gap-2">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No commands run yet for this server.</p>
            ) : (
              history.map((run) => (
                <div
                  key={run.id}
                  className={clsx(
                    "rounded-md border px-4 py-3",
                    run.success
                      ? "border-white/10 bg-black/20"
                      : "border-red-500/20 bg-red-500/5",
                  )}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {run.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                        )}
                        <span className="font-mono text-xs text-slate-200">{run.command}</span>
                        {run.label ? (
                          <span className="text-xs text-slate-500">({run.label})</span>
                        ) : null}
                      </div>
                      {run.output ? (
                        <pre className="mt-1 truncate font-mono text-xs text-slate-400">
                          {run.output}
                        </pre>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">
                      {run.server.name} — {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
