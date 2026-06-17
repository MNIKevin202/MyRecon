"use client";

import { useState } from "react";
import { Server, ChevronRight, Star } from "lucide-react";
import { Panel } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type ServerOption = {
  id: string;
  name: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  isDefault: boolean;
};

export function ServerPicker({ servers }: { servers: ServerOption[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function select(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/servers/${id}/select`, { method: "POST" });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select server");
      setBusyId(null);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Panel className="w-full max-w-lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-500">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Select a server</h1>
            <p className="text-sm text-slate-400">
              Choose which server to manage. You can switch anytime from the Servers page.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2">
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => select(server.id)}
              disabled={busyId !== null}
              className={clsx(
                "flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-orange-400/50 hover:bg-white/[0.06] disabled:opacity-50",
                busyId === server.id && "border-orange-400/60",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-white">{server.name}</span>
                  {server.isDefault ? (
                    <span className="flex shrink-0 items-center gap-1 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-100">
                      <Star className="h-2.5 w-2.5" /> Last used
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-400">
                  {server.host}:{server.gamePort} · RCON {server.rconPort} · {server.rconType}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      </Panel>
    </main>
  );
}
