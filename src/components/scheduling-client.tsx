"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  Play,
  Plus,
  Power,
  RotateCcw,
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

type ScheduledJob = {
  id: string;
  serverId: string;
  name: string;
  cron: string;
  command: string;
  status: "ENABLED" | "DISABLED";
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  server: { id: string; name: string };
};

const emptyForm = {
  serverId: "",
  name: "",
  cron: "*/30 * * * *",
  command: "",
  status: "ENABLED" as "ENABLED" | "DISABLED",
};

export function SchedulingClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((s) => s.isDefault) ?? servers[0];

  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [form, setForm] = useState({ ...emptyForm, serverId: defaultServer?.id ?? "" });
  const [runResult, setRunResult] = useState<{ jobId: string; text: string; success: boolean } | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  }

  const loadJobs = useCallback(async () => {
    setBusy("load");
    try {
      const data = await api<{ jobs: ScheduledJob[] }>("/api/scheduling");
      setJobs(data.jobs);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  function openAdd() {
    setEditingJob(null);
    setForm({ ...emptyForm, serverId: defaultServer?.id ?? "" });
    setShowForm(true);
  }

  function openEdit(job: ScheduledJob) {
    setEditingJob(job);
    setForm({
      serverId: job.serverId,
      name: job.name,
      cron: job.cron,
      command: job.command,
      status: job.status,
    });
    setShowForm(true);
  }

  async function submitJob() {
    if (!form.name.trim() || !form.command.trim() || !form.cron.trim() || !form.serverId) return;
    setBusy("save");
    try {
      if (editingJob) {
        await api(`/api/scheduling/${editingJob.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        flash("Scheduled job updated.");
      } else {
        await api("/api/scheduling", {
          method: "POST",
          body: JSON.stringify(form),
        });
        flash("Scheduled job created.");
      }
      await loadJobs();
      setShowForm(false);
      setEditingJob(null);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteJob(job: ScheduledJob) {
    if (!window.confirm(`Delete scheduled job "${job.name}"?`)) return;
    setBusy(`delete-${job.id}`);
    try {
      await api(`/api/scheduling/${job.id}`, { method: "DELETE" });
      await loadJobs();
      flash("Scheduled job deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(job: ScheduledJob) {
    setBusy(`toggle-${job.id}`);
    try {
      await api(`/api/scheduling/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          serverId: job.serverId,
          name: job.name,
          cron: job.cron,
          command: job.command,
          status: job.status === "ENABLED" ? "DISABLED" : "ENABLED",
        }),
      });
      await loadJobs();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runNow(job: ScheduledJob) {
    setBusy(`run-${job.id}`);
    setRunResult(null);
    try {
      const result = await api<{ output: string }>(`/api/scheduling/${job.id}/run`, { method: "POST" });
      setRunResult({ jobId: job.id, text: result.output ?? "Done.", success: true });
      await loadJobs();
    } catch (error) {
      setRunResult({
        jobId: job.id,
        text: error instanceof Error ? error.message : "Command failed.",
        success: false,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scheduling</h1>
          <p className="mt-1 text-sm text-slate-400">
            Define scheduled commands using cron expressions. Run them on demand with{" "}
            <span className="text-slate-300">Run now</span>, or enable a background worker to run them automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={loadJobs} disabled={busy === "load"}>
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openAdd} disabled={servers.length === 0}>
            <Plus className="h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          {notice}
        </div>
      ) : null}

      {showForm ? (
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <CalendarClock className="h-4 w-4 text-orange-400" />
              {editingJob ? "Edit Scheduled Job" : "New Scheduled Job"}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingJob(null);
              }}
              className="text-slate-500 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Nightly restart"
                autoFocus
              />
            </Field>
            <Field label="Server">
              <Select
                value={form.serverId}
                onChange={(e) => setForm((f) => ({ ...f, serverId: e.target.value }))}
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Cron expression" hint="5 fields: minute hour day month weekday">
              <Input
                value={form.cron}
                onChange={(e) => setForm((f) => ({ ...f, cron: e.target.value }))}
                placeholder="0 4 * * *"
                className="font-mono"
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ENABLED" | "DISABLED" }))}
              >
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Command">
              <Input
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                placeholder="e.g. restart"
                className="font-mono"
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={submitJob}
              disabled={!form.name.trim() || !form.command.trim() || !form.cron.trim() || !form.serverId || busy === "save"}
            >
              {editingJob ? "Update" : "Create Job"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingJob(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <CalendarClock className="h-4 w-4 text-orange-400" />
          Scheduled Jobs
        </h2>

        {jobs.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            {servers.length === 0
              ? "Add a server first to create scheduled jobs."
              : "No scheduled jobs yet. Click New Job to get started."}
          </p>
        ) : (
          <div className="grid gap-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="group rounded-md border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.04]"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{job.name}</span>
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs",
                          job.status === "ENABLED"
                            ? "bg-green-500/15 text-green-300"
                            : "bg-white/[0.06] text-slate-400",
                        )}
                      >
                        {job.status === "ENABLED" ? "Enabled" : "Disabled"}
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
                        {job.server.name}
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-400">
                        {job.cron}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-400">{job.command}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Last run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "never"}
                    </div>
                    {runResult?.jobId === job.id ? (
                      <div
                        className={clsx(
                          "mt-2 rounded-md border p-2 font-mono text-xs",
                          runResult.success
                            ? "border-green-500/20 bg-green-500/10 text-green-100"
                            : "border-red-500/30 bg-red-500/10 text-red-100",
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 font-sans text-xs font-semibold">
                          {runResult.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {runResult.success ? "Output" : "Error"}
                        </div>
                        <pre className="whitespace-pre-wrap">{runResult.text}</pre>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="secondary"
                      onClick={() => runNow(job)}
                      disabled={Boolean(busy)}
                      className="h-7 px-2 text-xs"
                      title="Run now"
                    >
                      <Play className="h-3 w-3" />
                      Run now
                    </Button>
                    <button
                      onClick={() => toggleStatus(job)}
                      disabled={Boolean(busy)}
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded border border-white/10",
                        job.status === "ENABLED" ? "text-green-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-200",
                      )}
                      title={job.status === "ENABLED" ? "Disable" : "Enable"}
                    >
                      <Power className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => openEdit(job)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-500 hover:text-slate-200"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteJob(job)}
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
  );
}
