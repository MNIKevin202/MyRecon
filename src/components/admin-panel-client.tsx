"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Gift, Minus, Plus, Search, X } from "lucide-react";
import { Button, Panel, Select } from "@/components/ui";
import { clsx } from "@/lib/utils";
import {
  ITEM_CATEGORIES,
  RUST_ITEMS,
  type ItemCategory,
  type RustItem,
  itemImageUrl,
  itemsByCategory,
} from "@/lib/rust-items";

type Server = { id: string; name: string; isDefault: boolean };

type ConnectedPlayer = {
  steamId: string;
  name: string;
  ping: number | null;
};


function ItemImage({ shortname, name }: { shortname: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-white/[0.04] text-[10px] font-semibold text-slate-500 text-center leading-tight px-0.5">
        {name.slice(0, 4)}
      </div>
    );
  }

  return (
    <img
      src={itemImageUrl(shortname)}
      alt={name}
      className="h-12 w-12 object-contain"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function GivePanel({
  item,
  serverId,
  players,
  invokerName,
  onClose,
}: {
  item: RustItem;
  serverId: string;
  players: ConnectedPlayer[];
  invokerName: string;
  onClose: () => void;
}) {
  const [selectedSteamId, setSelectedSteamId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(1);
  const [customInput, setCustomInput] = useState("");
  const [amountMode, setAmountMode] = useState<"100" | "1000" | "stack" | "custom">("100");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sort players: invoker name match first, then alphabetical
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aIsInvoker = a.name.toLowerCase() === invokerName.toLowerCase();
      const bIsInvoker = b.name.toLowerCase() === invokerName.toLowerCase();
      if (aIsInvoker) return -1;
      if (bIsInvoker) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [players, invokerName]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Resolve amount from mode
  useEffect(() => {
    if (amountMode === "100") setAmount(100);
    else if (amountMode === "1000") setAmount(1000);
    else if (amountMode === "stack") setAmount(item.stackSize);
    else if (amountMode === "custom") {
      const n = parseInt(customInput, 10);
      setAmount(Number.isFinite(n) && n > 0 ? n : 1);
    }
  }, [amountMode, customInput, item.stackSize]);

  async function giveItem() {
    if (!selectedSteamId) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/give-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: selectedSteamId, itemShortname: item.shortname, amount }),
      });
      setResult(res.ok ? "success" : "error");
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
      window.setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-stretch justify-end" style={{ pointerEvents: "none" }}>
      <div
        ref={panelRef}
        className="flex h-full w-80 flex-col border-l border-white/10 bg-[#0c1017] shadow-2xl shadow-black/50"
        style={{ pointerEvents: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.05]">
            <ItemImage shortname={item.shortname} name={item.name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            <p className="text-xs text-slate-500">{item.shortname}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Give to */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Give to</p>
            {players.length === 0 ? (
              <p className="text-xs text-slate-500">No players connected.</p>
            ) : (
              <div className="grid gap-1">
                {sortedPlayers.map((p) => {
                  const isInvoker = p.name.toLowerCase() === invokerName.toLowerCase();
                  const selected = selectedSteamId === p.steamId;
                  return (
                    <button
                      key={p.steamId}
                      onClick={() => setSelectedSteamId(selected ? null : p.steamId)}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition",
                        selected
                          ? "bg-emerald-600/25 text-emerald-100"
                          : "hover:bg-white/[0.06] text-slate-300",
                      )}
                    >
                      <div className={clsx(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                        selected ? "border-emerald-400 bg-emerald-600" : "border-white/20",
                      )}>
                        {selected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="flex-1 truncate">{p.name}</span>
                      {isInvoker && (
                        <span className="shrink-0 rounded bg-emerald-600/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          You
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["100", "1000", "stack", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAmountMode(mode)}
                  className={clsx(
                    "rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition",
                    amountMode === mode
                      ? "border-emerald-400 bg-emerald-600/25 text-emerald-100"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white",
                  )}
                >
                  {mode === "stack" ? `Stack (${item.stackSize})` : mode === "custom" ? "Custom" : mode}
                </button>
              ))}
            </div>

            {amountMode === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    const n = Math.max(1, (parseInt(customInput, 10) || 1) - 1);
                    setCustomInput(String(n));
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 text-slate-400 hover:text-white"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-sm text-white outline-none focus:border-emerald-400"
                />
                <button
                  onClick={() => {
                    const n = (parseInt(customInput, 10) || 0) + 1;
                    setCustomInput(String(n));
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 text-slate-400 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}

            <p className="mt-1.5 text-right text-xs text-slate-500">
              Giving <span className="text-slate-200">{amount.toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-4 space-y-2">
          {result === "success" && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <Check className="h-4 w-4 shrink-0" /> Given successfully
            </div>
          )}
          {result === "error" && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              Failed to give item
            </div>
          )}
          <Button
            onClick={giveItem}
            disabled={!selectedSteamId || busy}
            className="w-full justify-center"
          >
            <Gift className="h-4 w-4" />
            {busy ? "Giving…" : `Give ${amount.toLocaleString()}×`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanelClient({
  servers,
  invokerName,
}: {
  servers: Server[];
  invokerName: string;
}) {
  const defaultServer = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [category, setCategory] = useState<ItemCategory>("All");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<RustItem | null>(null);
  const [players, setPlayers] = useState<ConnectedPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const items = useMemo(() => {
    const base = itemsByCategory(category);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (i) => i.name.toLowerCase().includes(q) || i.shortname.toLowerCase().includes(q),
    );
  }, [category, search]);

  const loadPlayers = useCallback(async () => {
    if (!serverId) return;
    setPlayersLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/players`);
      if (!res.ok) return;
      const data = await res.json() as { connectedPlayers: ConnectedPlayer[] };
      setPlayers(data.connectedPlayers ?? []);
    } catch {
      // ignore
    } finally {
      setPlayersLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    const t = window.setTimeout(() => { void loadPlayers(); }, 0);
    return () => window.clearTimeout(t);
  }, [loadPlayers]);

  function openItem(item: RustItem) {
    setSelectedItem(item);
    void loadPlayers();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">MyRcon exclusive tools for managing your server.</p>
        </div>
        {servers.length > 1 && (
          <Select
            value={serverId}
            onChange={(e) => { setServerId(e.target.value); setSelectedItem(null); }}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Give Item Section */}
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Give Item</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 rounded-md border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-400 sm:w-56"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {ITEM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={clsx(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition",
                category === cat
                  ? "bg-emerald-600/25 text-emerald-100"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Item count */}
        <p className="mb-3 text-xs text-slate-600">{items.length} item{items.length !== 1 ? "s" : ""}</p>

        {/* Item grid */}
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">No items found.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {items.map((item) => {
              const active = selectedItem?.shortname === item.shortname;
              return (
                <button
                  key={item.shortname}
                  onClick={() => openItem(item)}
                  className={clsx(
                    "group flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition",
                    active
                      ? "border-emerald-500/60 bg-emerald-500/15"
                      : "border-white/[0.06] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center">
                    <ItemImage shortname={item.shortname} name={item.name} />
                  </div>
                  <p className={clsx(
                    "w-full truncate text-[10px] leading-tight transition",
                    active ? "text-emerald-200" : "text-slate-400 group-hover:text-slate-200",
                  )}>
                    {item.name}
                  </p>
                  {active && <ChevronRight className="h-3 w-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Give panel slide-in */}
      {selectedItem && (
        <GivePanel
          item={selectedItem}
          serverId={serverId}
          players={players}
          invokerName={invokerName}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
