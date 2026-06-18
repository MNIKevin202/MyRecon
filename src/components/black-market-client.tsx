"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Coins, MapPin, Plus, RefreshCw, Save, Search, Store, Trash2, Users, X } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";
import {
  ITEM_CATEGORIES,
  type ItemCategory,
  type RustItem,
  itemImageUrl,
  itemsByCategory,
} from "@/lib/rust-items";

type Server = { id: string; name: string; isDefault: boolean };
type ShopItem = { index: number; shortname: string; displayName: string; price: number; amount: number };
type Config = { currencyShortname: string; currencyName: string; items: ShopItem[]; error?: string };
type Npc = { index: number; x: number; y: number; z: number; yaw: number; name: string; showName: boolean };
type AnalyticsItem = { shortname: string; displayName: string; price: number; amount: number; count: number; qty: number; revenue: number; suggestion: string };
type Analytics = { currencyName: string; totalSales: number; totalRevenue: number; items: AnalyticsItem[]; error?: string };
type Buyer = { steamId: string; name: string; purchases: number; spent: number };
type Looker = { steamId: string; name: string; opens: number };
type Buyers = { buyers: Buyer[]; lookers: Looker[]; error?: string };

type Tab = "items" | "markets" | "analytics" | "buyers";

const CURRENCIES = [
  { shortname: "scrap", name: "Scrap" },
  { shortname: "metal.fragments", name: "Metal Fragments" },
  { shortname: "metal.refined", name: "High Quality Metal" },
  { shortname: "lowgradefuel", name: "Low Grade Fuel" },
  { shortname: "wood", name: "Wood" },
  { shortname: "stones", name: "Stones" },
  { shortname: "cloth", name: "Cloth" },
  { shortname: "sulfur", name: "Sulfur" },
];

function ItemImg({ shortname, name, size = 44 }: { shortname: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err)
    return <div style={{ width: size, height: size }} className="flex items-center justify-center rounded bg-white/[0.04] px-0.5 text-center text-[9px] leading-tight text-slate-500">{name.slice(0, 5)}</div>;
  return <img src={itemImageUrl(shortname)} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain" loading="lazy" />;
}

export function BlackMarketClient({ servers }: { servers: Server[] }) {
  const def = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(def?.id ?? "");
  const [tab, setTab] = useState<Tab>("items");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [config, setConfig] = useState<Config | null>(null);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [buyers, setBuyers] = useState<Buyers | null>(null);

  const [curShort, setCurShort] = useState("scrap");
  const [curName, setCurName] = useState("Scrap");

  // catalog + configure popup
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [catCategory, setCatCategory] = useState<ItemCategory>("All");
  const [picked, setPicked] = useState<RustItem | null>(null);
  const [cfgPrice, setCfgPrice] = useState("100");
  const [cfgAmount, setCfgAmount] = useState("1");
  const [cfgCurrency, setCfgCurrency] = useState("scrap");

  // place npc form
  const [npX, setNpX] = useState("");
  const [npY, setNpY] = useState("");
  const [npZ, setNpZ] = useState("");

  const catalogItems = useMemo(() => {
    const base = itemsByCategory(catCategory);
    const q = catSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) => i.name.toLowerCase().includes(q) || i.shortname.toLowerCase().includes(q));
  }, [catCategory, catSearch]);

  const loadConfig = useCallback(async () => {
    if (!serverId) return;
    const cfg = await api<Config>(`/api/servers/${serverId}/black-market?type=config`);
    if (cfg.error) { setNotice(cfg.error); setConfig(null); return; }
    setConfig(cfg);
    setCurShort(cfg.currencyShortname);
    setCurName(cfg.currencyName);
    const n = await api<{ npcs: Npc[] }>(`/api/servers/${serverId}/black-market?type=npcs`);
    setNpcs(n.npcs ?? []);
  }, [serverId]);

  const loadTab = useCallback(async () => {
    if (!serverId) return;
    setBusy(true); setNotice(null);
    try {
      if (tab === "analytics") {
        const a = await api<Analytics>(`/api/servers/${serverId}/black-market?type=analytics`);
        if (a.error) setNotice(a.error); else setAnalytics(a);
      } else if (tab === "buyers") {
        const b = await api<Buyers>(`/api/servers/${serverId}/black-market?type=buyers`);
        if (b.error) setNotice(b.error); else setBuyers(b);
      } else {
        await loadConfig();
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setBusy(false);
    }
  }, [serverId, tab, loadConfig]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await api<{ success?: boolean; error?: string }>(`/api/servers/${serverId}/black-market`, { method: "POST", body: JSON.stringify(body) });
      if (res.error) { setNotice(res.error); return; }
      setNotice(ok);
      await loadTab();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function openCatalog() {
    setCfgCurrency(config?.currencyShortname ?? "scrap");
    setPicked(null); setCatSearch(""); setCatCategory("All"); setCatalogOpen(true);
  }
  function pickItem(it: RustItem) { setPicked(it); setCfgPrice("100"); setCfgAmount("1"); }

  async function addFromCatalog() {
    if (!picked || !serverId) return;
    setBusy(true);
    try {
      if (config && cfgCurrency !== config.currencyShortname) {
        const cur = CURRENCIES.find((c) => c.shortname === cfgCurrency);
        await api(`/api/servers/${serverId}/black-market`, { method: "POST", body: JSON.stringify({ action: "setcurrency", shortname: cfgCurrency, name: cur?.name ?? cfgCurrency }) });
      }
      await api(`/api/servers/${serverId}/black-market`, { method: "POST", body: JSON.stringify({ action: "additem", shortname: picked.shortname, displayName: picked.name, price: cfgPrice, amount: cfgAmount }) });
      setNotice(`Added ${picked.name} to the shop.`);
      setPicked(null); setCatalogOpen(false);
      await loadConfig();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Add failed");
    } finally { setBusy(false); }
  }

  const tabs: { id: Tab; label: string; icon: typeof Store }[] = [
    { id: "items",     label: "Shop Items", icon: Store },
    { id: "markets",   label: "Markets",    icon: MapPin },
    { id: "analytics", label: "Analytics",  icon: BarChart3 },
    { id: "buyers",    label: "Buyers",     icon: Users },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Black Market</h1>
          <p className="mt-1 text-sm text-slate-400">Shop, vendor NPCs, sales analytics, and buyers.</p>
        </div>
        <div className="flex gap-3">
          <Select value={serverId} onChange={(e) => setServerId(e.target.value)} className="min-w-56">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => void loadTab()} disabled={busy}><RefreshCw className="h-4 w-4" />Refresh</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={clsx("flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px", tab === t.id ? "border-emerald-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300")}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      {/* ITEMS TAB */}
      {tab === "items" && (!config ? (
        <Panel><p className="text-sm text-slate-500">No data. Install <span className="text-emerald-400">Black Market</span> via Exclusive Plugins and make sure it&apos;s loaded, then Refresh.</p></Panel>
      ) : (
        <>
          <Panel>
            <div className="mb-3 flex items-center gap-2"><Coins className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-semibold text-white">Currency</h2></div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Item shortname"><Input value={curShort} onChange={(e) => setCurShort(e.target.value)} className="font-mono" /></Field>
              <Field label="Display name"><Input value={curName} onChange={(e) => setCurName(e.target.value)} /></Field>
              <Button onClick={() => act({ action: "setcurrency", shortname: curShort, name: curName }, "Currency updated.")} disabled={busy}><Save className="h-4 w-4" />Save</Button>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-lg font-semibold text-white">Shop Items ({config.items.length})</h2>
            <div className="grid gap-2">
              {config.items.map((it) => (
                <ItemRow key={it.index} item={it} busy={busy}
                  onSave={(price, amount, name) => act({ action: "updateitem", index: it.index, price, amount, displayName: name }, "Item updated.")}
                  onRemove={() => act({ action: "removeitem", index: it.index }, "Item removed.")} />
              ))}
              {config.items.length === 0 ? <p className="text-sm text-slate-500">No items yet — add one below.</p> : null}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <Button onClick={openCatalog} disabled={busy}><Plus className="h-4 w-4" />Add Item from Catalog</Button>
            </div>
          </Panel>
        </>
      ))}

      {/* MARKETS TAB */}
      {tab === "markets" && (
        <Panel>
          <div className="mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-semibold text-white">Vendor NPCs ({npcs.length})</h2></div>
          <div className="grid gap-2">
            {npcs.map((n) => (
              <NpcRow key={n.index} npc={n} busy={busy}
                onSave={(name, showName) => act({ action: "setnpc", index: n.index, name, showName }, "NPC updated.")}
                onRemove={() => act({ action: "removenpc", index: n.index }, "NPC removed.")} />
            ))}
            {npcs.length === 0 ? <p className="text-sm text-slate-500">No NPCs placed. Use <span className="font-mono">/bm place</span> in-game, or add by coordinates below.</p> : null}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Place NPC by coordinates</p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="X"><Input type="number" value={npX} onChange={(e) => setNpX(e.target.value)} className="w-28" /></Field>
              <Field label="Y"><Input type="number" value={npY} onChange={(e) => setNpY(e.target.value)} className="w-28" /></Field>
              <Field label="Z"><Input type="number" value={npZ} onChange={(e) => setNpZ(e.target.value)} className="w-28" /></Field>
              <Button onClick={() => { if (npX && npY && npZ) void act({ action: "placenpc", x: npX, y: npY, z: npZ }, "NPC placed."); }} disabled={busy || !npX || !npY || !npZ}><MapPin className="h-4 w-4" />Place</Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Tip: in-game <span className="font-mono">/bm place</span> uses your exact position.</p>
          </div>
        </Panel>
      )}

      {/* ANALYTICS TAB */}
      {tab === "analytics" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel><div className="text-sm text-slate-400">Total Sales</div><div className="mt-2 text-2xl font-bold text-white">{analytics?.totalSales ?? 0}</div></Panel>
            <Panel><div className="text-sm text-slate-400">Total Revenue ({analytics?.currencyName ?? "currency"})</div><div className="mt-2 text-2xl font-bold text-emerald-400">{(analytics?.totalRevenue ?? 0).toLocaleString()}</div></Panel>
          </div>
          <Panel>
            <h2 className="mb-3 text-lg font-semibold text-white">Item Performance</h2>
            <div className="grid gap-2">
              <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.8fr_1.6fr] gap-2 border-b border-white/10 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>Item</span><span className="text-right">Sold</span><span className="text-right">Qty</span><span className="text-right">Revenue</span><span>Suggestion</span>
              </div>
              {(analytics?.items ?? []).map((it) => (
                <div key={it.shortname} className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.8fr_1.6fr] items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0"><ItemImg shortname={it.shortname} name={it.displayName} size={24} /><span className="truncate text-slate-200">{it.displayName}</span></div>
                  <span className="text-right text-slate-300">{it.count}</span>
                  <span className="text-right text-slate-300">{it.qty}</span>
                  <span className="text-right text-emerald-400">{it.revenue.toLocaleString()}</span>
                  <span className={clsx("truncate text-xs", it.suggestion.startsWith("Top") ? "text-amber-400" : it.suggestion.startsWith("No") ? "text-red-400/80" : "text-slate-500")}>{it.suggestion}</span>
                </div>
              ))}
              {(analytics?.items?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No analytics yet.</p> : null}
            </div>
          </Panel>
        </>
      )}

      {/* BUYERS TAB */}
      {tab === "buyers" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h2 className="mb-3 text-lg font-semibold text-white">Buyers ({buyers?.buyers.length ?? 0})</h2>
            <div className="grid gap-2">
              {(buyers?.buyers ?? []).map((b) => (
                <div key={b.steamId} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0"><div className="truncate text-sm text-slate-200">{b.name || "Unknown"}</div><div className="font-mono text-xs text-slate-500">{b.steamId}</div></div>
                  <div className="text-right text-xs"><div className="text-emerald-400">{b.spent.toLocaleString()} spent</div><div className="text-slate-500">{b.purchases} purchase{b.purchases === 1 ? "" : "s"}</div></div>
                </div>
              ))}
              {(buyers?.buyers.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No purchases yet.</p> : null}
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-lg font-semibold text-white">Window Shoppers ({buyers?.lookers.length ?? 0})</h2>
            <p className="mb-3 text-xs text-slate-500">Interacted with the NPC but never bought.</p>
            <div className="grid gap-2">
              {(buyers?.lookers ?? []).map((l) => (
                <div key={l.steamId} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0"><div className="truncate text-sm text-slate-200">{l.name || "Unknown"}</div><div className="font-mono text-xs text-slate-500">{l.steamId}</div></div>
                  <div className="text-right text-xs text-slate-400">{l.opens} visit{l.opens === 1 ? "" : "s"}</div>
                </div>
              ))}
              {(buyers?.lookers.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No window shoppers.</p> : null}
            </div>
          </Panel>
        </div>
      )}

      {/* CATALOG MODAL */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCatalogOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-lg font-semibold text-white">{picked ? "Configure Sale" : "Add Item — Catalog"}</h2>
              <button onClick={() => setCatalogOpen(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {!picked ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input type="search" placeholder="Search items…" value={catSearch} onChange={(e) => setCatSearch(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-400" />
                  </div>
                </div>
                <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 py-2">
                  {ITEM_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCatCategory(c)} className={clsx("shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition", catCategory === c ? "bg-emerald-600/25 text-emerald-100" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}>{c}</button>
                  ))}
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-4 md:grid-cols-6">
                  {catalogItems.map((it) => (
                    <button key={it.shortname} onClick={() => pickItem(it)} className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-center transition hover:border-emerald-500/50 hover:bg-white/[0.06]">
                      <ItemImg shortname={it.shortname} name={it.name} /><span className="w-full truncate text-[10px] text-slate-400">{it.name}</span>
                    </button>
                  ))}
                  {catalogItems.length === 0 ? <p className="col-span-full py-8 text-center text-sm text-slate-600">No items found.</p> : null}
                </div>
              </>
            ) : (
              <div className="grid gap-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white/[0.05]"><ItemImg shortname={picked.shortname} name={picked.name} size={48} /></div>
                  <div><p className="text-base font-semibold text-white">{picked.name}</p><p className="font-mono text-xs text-slate-500">{picked.shortname}</p></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Price"><Input type="number" value={cfgPrice} onChange={(e) => setCfgPrice(e.target.value)} /></Field>
                  <Field label="Amount per purchase"><Input type="number" value={cfgAmount} onChange={(e) => setCfgAmount(e.target.value)} /></Field>
                  <Field label="Currency">
                    <Select value={cfgCurrency} onChange={(e) => setCfgCurrency(e.target.value)}>
                      {CURRENCIES.some((c) => c.shortname === cfgCurrency) ? null : <option value={cfgCurrency}>{cfgCurrency}</option>}
                      {CURRENCIES.map((c) => <option key={c.shortname} value={c.shortname}>{c.name}</option>)}
                    </Select>
                  </Field>
                </div>
                {config && cfgCurrency !== config.currencyShortname ? <p className="text-xs text-amber-500/80">Changing the currency applies to the whole shop (single shared currency).</p> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPicked(null)}>Back to catalog</Button>
                  <Button onClick={addFromCatalog} disabled={busy}><Plus className="h-4 w-4" />Add to Shop</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, busy, onSave, onRemove }: {
  item: ShopItem; busy: boolean;
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
      <Button variant="secondary" onClick={() => onSave(price, amount, name)} disabled={busy} className="py-1 px-2 text-xs"><Save className="h-3.5 w-3.5" />Save</Button>
      <Button variant="danger" onClick={onRemove} disabled={busy} className="py-1 px-2 text-xs"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function NpcRow({ npc, busy, onSave, onRemove }: {
  npc: Npc; busy: boolean;
  onSave: (name: string, showName: boolean) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(npc.name);
  const [showName, setShowName] = useState(npc.showName);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="font-mono text-xs text-slate-500">#{npc.index} — {npc.x.toFixed(0)}, {npc.y.toFixed(0)}, {npc.z.toFixed(0)}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Market name (e.g. Smuggler's Den)" className="w-56 py-1 text-xs" />
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
        Show name on shop
      </label>
      <Button variant="secondary" onClick={() => onSave(name, showName)} disabled={busy} className="py-1 px-2 text-xs"><Save className="h-3.5 w-3.5" />Save</Button>
      <Button variant="danger" onClick={onRemove} disabled={busy} className="py-1 px-2 text-xs"><Trash2 className="h-3.5 w-3.5" />Remove</Button>
    </div>
  );
}
