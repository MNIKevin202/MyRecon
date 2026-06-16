"use client";

import { useState } from "react";
import { Check, Download, Lock, Package, Server, Zap } from "lucide-react";
import { clsx } from "@/lib/utils";
import { Button, Panel } from "@/components/ui";

type PluginMeta = {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  tags: string[];
  filename: string;
};

type ServerOption = {
  id: string;
  name: string;
  isDefault: boolean;
  sftpEnabled: boolean;
};

type InstallState = "idle" | "installing" | "success" | "error";

function PluginCard({
  plugin,
  servers,
}: {
  plugin: PluginMeta;
  servers: ServerOption[];
}) {
  const [serverId, setServerId] = useState(
    servers.find((s) => s.isDefault && s.sftpEnabled)?.id ??
      servers.find((s) => s.sftpEnabled)?.id ??
      servers[0]?.id ??
      "",
  );
  const [state, setState] = useState<InstallState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [installedPath, setInstalledPath] = useState("");

  const selectedServer = servers.find((s) => s.id === serverId);
  const canInstall = !!selectedServer?.sftpEnabled;

  async function install() {
    if (!serverId || !canInstall) return;
    setState("installing");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/exclusive-plugins/${plugin.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; path?: string; error?: string };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Installation failed");
        setState("error");
      } else {
        setInstalledPath(data.path ?? "");
        setState("success");
      }
    } catch {
      setErrorMsg("Network error — check your connection.");
      setState("error");
    }
  }

  return (
    <Panel className="flex flex-col gap-5">
      {/* Top row */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
          <Package className="h-6 w-6 text-orange-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{plugin.name}</h3>
            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              v{plugin.version}
            </span>
            <span className="flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
              <Lock className="h-2.5 w-2.5" /> MyRcon Exclusive
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{plugin.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plugin.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Long description */}
      <p className="text-sm text-slate-500 leading-relaxed">{plugin.longDescription}</p>

      {/* Install footer */}
      <div className="flex flex-wrap items-end gap-3 border-t border-white/[0.07] pt-4">
        {/* Server selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1">
            <Server className="h-2.5 w-2.5" /> Install to
          </label>
          {servers.length === 0 ? (
            <p className="text-xs text-slate-500">No servers configured.</p>
          ) : (
            <select
              value={serverId}
              onChange={(e) => { setServerId(e.target.value); setState("idle"); }}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-orange-400"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.sftpEnabled}>
                  {s.name}{!s.sftpEnabled ? " (SFTP disabled)" : ""}
                </option>
              ))}
            </select>
          )}
          {selectedServer && !selectedServer.sftpEnabled && (
            <p className="text-[11px] text-amber-500/80">Enable SFTP in server settings to install.</p>
          )}
        </div>

        <div className="ml-auto flex flex-col items-end gap-1.5">
          {state === "success" && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Installed
              {installedPath && <span className="font-mono text-slate-500"> → {installedPath}</span>}
            </p>
          )}
          {state === "error" && (
            <p className="max-w-xs text-right text-xs text-red-400">{errorMsg}</p>
          )}
          <Button
            onClick={install}
            disabled={!canInstall || state === "installing"}
            className={clsx(
              state === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15",
            )}
          >
            {state === "installing" ? (
              <>
                <Zap className="h-4 w-4 animate-pulse" /> Installing…
              </>
            ) : state === "success" ? (
              <>
                <Check className="h-4 w-4" /> Installed
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Install Plugin
              </>
            )}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function ExclusivePluginsClient({
  plugins,
  servers,
}: {
  plugins: PluginMeta[];
  servers: ServerOption[];
}) {
  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Exclusive Plugins</h1>
          <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
            <Lock className="h-3 w-3" /> MyRcon Only
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Plugins built by MyRcon — available exclusively in this software. Install them directly
          to your Rust server via SFTP with one click.
        </p>
      </div>

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <Panel>
          <p className="py-8 text-center text-sm text-slate-500">No exclusive plugins available yet.</p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} servers={servers} />
          ))}
        </div>
      )}
    </div>
  );
}
