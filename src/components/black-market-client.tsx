"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, MapPin, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api } from "@/lib/utils";

type Server = { id: string; name: string; isDefault: boolean };

type ShopItem = { index: number; shortname: string; displayName: string; price: number; amount: number };
type Config = {
  currencyShortname: string;
  currencyName: string;
  items: ShopItem[];
  error?: string;
};
type Npc = { index: number; x: number; y: number; z: number; yaw: number };

export function BlackMarketClient({ servers }: { servers: Server[] }) {
  const def = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(def?.id ?? "");
  const [config, setConfig] = useState<Config | null>(null);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // currency edit
  const [curShort, setCurShort] = useState("scrap");
  const [curName, setCurName] = useState("Scrap");

  // new item form
  const [niShort, setNiShort] = useState("");
  const [niName, setNiName] = useState("");
  const [niPrice, setNiPrice] = useState("100");
  const [niAmount, setNiAmount] = useState("1");

  // place npc form
  const [npX, setNpX] = useState("");
  const [npY, setNpY] = useState("");
  const [npZ, setNpZ] = useState("");

  const load = useCallback(async () => {
    if (!serverId) return;
    setBusy(true);
    setNotice(null);
    try {
      const cfg = await api<Config>(`/api/servers/${serverId}/black-market?type=config`);
      if (cfg.error) { setNotice(cfg.error); setConfig(null); return; }
      setConfig(cfg);
      setCurShort(cfg.currencyShortname);
      setCurName(cfg.currencyName);
      const n = await api<{ npcs: Npc[]; error?: string }>(`/api/servers/${serverId}/black-market?type=npcs`);
      setNpcs(n.npcs ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to load Black Market config");
      setConfig(null);
    } finally {
      setBusy(false);
    }
  }, [serverId]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await api<{ success?: boolean; error?: string }>(`/api/servers/${serverId}/black-market`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.error) { setNotice(res.error); return; }
      setNotice(ok);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Black Market</h1>
          <p className="mt-1 text-sm text-slate-400">Edit shop items, currency, and vendor NPCs.</p>
        </div>
        <div className="flex gap-3">
          <Select value={serverId} onChange={(e) => setServerId(e.target.value)} className="min-w-56">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      {!config ? (
        <Panel>
          <p className="text-sm text-slate-500">
            No data. Install <span className="text-emerald-400">Black Market</span> via Exclusive Plugins and make sure it&apos;s loaded, then Refresh.
          </p>
        </Panel>
      ) : (
        <>
          {/* Currency */}
          <Panel>
            <div className="mb-3 flex items-center gap-2">
              <Coins className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Currency</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Item shortname"><Input value={curShort} onChange={(e) => setCurShort(e.target.value)} className="font-mono" /></Field>
              <Field label="Display name"><Input value={curName} onChange={(e) => setCurName(e.target.value)} /></Field>
              <Button onClick={() => act({ action: "setcurrency", shortname: curShort, name: curName }, "Currency updated.")} disabled={busy}>
                <Save className="h-4 w-4" />Save
              </Button>
            </div>
          </Panel>

          {/* Items */}
          <Panel>
            <h2 className="mb-3 text-lg font-semibold text-white">Shop Items ({config.items.length})</h2>
            <div className="grid gap-2">
              {config.items.map((it) => (
                <ItemRow key={it.index} item={it} busy={busy}
                  onSave={(price, amount, name) => act({ action: "updateitem", index: it.index, price, amount, displayName: name }, "Item updated.")}
                  onRemove={() => act({ action: "removeitem", index: it.index }, "Item removed.")}
                />
              ))}
              {config.items.length === 0 ? <p className="text-sm text-slate-500">No items yet — add one below.</p> : null}
            </div>

            {/* Add item */}
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Add item</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Shortname"><Input value={niShort} onChange={(e) => setNiShort(e.target.value)} placeholder="rifle.ak" className="font-mono" /></Field>
                <Field label="Display name"><Input value={niName} onChange={(e) => setNiName(e.target.value)} placeholder="Optional" /></Field>
                <Field label="Price"><Input type="number" value={niPrice} onChange={(e) => setNiPrice(e.target.value)} className="w-24" /></Field>
                <Field label="Amount"><Input type="number" value={niAmount} onChange={(e) => setNiAmount(e.target.value)} className="w-24" /></Field>
                <Button
                  onClick={() => { if (niShort.trim()) void act({ action: "additem", shortname: niShort.trim(), price: niPrice, amount: niAmount, displayName: niName }, "Item added."); }}
                  disabled={busy || !niShort.trim()}
                >
                  <Plus className="h-4 w-4" />Add
                </Button>
              </div>
            </div>
          </Panel>

          {/* NPCs */}
          <Panel>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Vendor NPCs ({npcs.length})</h2>
            </div>
            <div className="grid gap-2">
              {npcs.map((n) => (
                <div key={n.index} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
                  <span className="font-mono text-sm text-slate-300">#{n.index} — {n.x.toFixed(0)}, {n.y.toFixed(0)}, {n.z.toFixed(0)}</span>
                  <Button variant="danger" onClick={() => act({ action: "removenpc", index: n.index }, "NPC removed.")} disabled={busy}>
                    <Trash2 className="h-4 w-4" />Remove
                  </Button>
                </div>
              ))}
              {npcs.length === 0 ? <p className="text-sm text-slate-500">No NPCs placed. Use <span className="font-mono">/blackmarket place</span> in-game, or enter coordinates below.</p> : null}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Place NPC by coordinates</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="X"><Input type="number" value={npX} onChange={(e) => setNpX(e.target.value)} className="w-28" /></Field>
                <Field label="Y"><Input type="number" value={npY} onChange={(e) => setNpY(e.target.value)} className="w-28" /></Field>
                <Field label="Z"><Input type="number" value={npZ} onChange={(e) => setNpZ(e.target.value)} className="w-28" /></Field>
                <Button
                  onClick={() => { if (npX && npY && npZ) void act({ action: "placenpc", x: npX, y: npY, z: npZ }, "NPC placed."); }}
                  disabled={busy || !npX || !npY || !npZ}
                >
                  <MapPin className="h-4 w-4" />Place
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Tip: in-game <span className="font-mono">/blackmarket place</span> uses your exact position — easier than typing coordinates.</p>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function ItemRow({ item, busy, onSave, onRemove }: {
  item: ShopItem;
  busy: boolean;
  onSave: (price: string, amount: string, name: string) => void;
  onRemove: () => void;
}) {
  const [price, setPrice] = useState(String(item.price));
  const [amount, setAmount] = useState(String(item.amount));
  const [name, setName] = useState(item.displayName);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="min-w-40 flex-1 font-mono text-sm text-slate-200">{item.shortname}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" className="w-40 py-1 text-xs" />
      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-20 py-1 text-xs" />
      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-20 py-1 text-xs" />
      <Button variant="secondary" onClick={() => onSave(price, amount, name)} disabled={busy} className="py-1 px-2 text-xs">
        <Save className="h-3.5 w-3.5" />Save
      </Button>
      <Button variant="danger" onClick={onRemove} disabled={busy} className="py-1 px-2 text-xs">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
