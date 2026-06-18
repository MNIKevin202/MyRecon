using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconBlackMarket", "MyRcon", "1.3.0")]
    [Description("Per-NPC Black Market shops with cloning, analytics, and buyer tracking.")]
    public class MyRconBlackMarket : RustPlugin
    {
        const string PermAdmin = "myrconblackmarket.admin";
        const string PermUse   = "myrconblackmarket.use";
        const string NpcPrefab  = "assets/prefabs/npc/bandit/shopkeepers/bandit_shopkeeper.prefab";
        const string SignPrefab = "assets/prefabs/deployable/signs/sign.post.single.prefab";
        const string UiName     = "MyRconBlackMarket_UI";

        PluginConfig _cfg;
        SavedData    _data;
        readonly List<BaseEntity> _npcs  = new List<BaseEntity>(); // parallel to _data.Markets
        readonly List<BaseEntity> _signs = new List<BaseEntity>(); // spawned signs (cleanup only)

        // ── Models ────────────────────────────────────────────────────────────────
        class ShopItem
        {
            public string Shortname   = "";
            public string DisplayName = "";
            public int    Price       = 100;
            public int    Amount      = 1;
        }

        class Market
        {
            public float  X, Y, Z, Yaw;
            public string Name              = "";
            public bool   ShowName          = false;
            public bool   Sign              = false;
            public string SignText          = "";
            public string CurrencyShortname = "scrap";
            public string CurrencyName      = "Scrap";
            public List<ShopItem> Items     = new List<ShopItem>();
        }

        class ItemStat   { public int Count; public int Qty; public int Revenue; }
        class PlayerStat { public string Name = ""; public int Opens; public int Purchases; public int Spent; }

        class SavedData
        {
            public List<Market> Markets                    = new List<Market>();
            public Dictionary<string, ItemStat>   ItemStats = new Dictionary<string, ItemStat>();
            public Dictionary<string, PlayerStat> Players   = new Dictionary<string, PlayerStat>();
        }

        // ── Config (defaults for newly placed markets) ────────────────────────────
        class PluginConfig
        {
            public float  InteractDistance       = 3.5f;
            public bool   RequireUsePermission   = false;
            public string DefaultCurrencyShortname = "scrap";
            public string DefaultCurrencyName    = "Scrap";
            public List<ShopItem> DefaultItems   = new List<ShopItem>();
        }

        protected override void LoadDefaultConfig()
        {
            _cfg = new PluginConfig
            {
                DefaultItems = new List<ShopItem>
                {
                    new ShopItem { Shortname = "rifle.ak",          DisplayName = "Assault Rifle",        Price = 600,  Amount = 1   },
                    new ShopItem { Shortname = "explosive.timed",   DisplayName = "Timed Explosive (C4)", Price = 1200, Amount = 1   },
                    new ShopItem { Shortname = "metal.facemask",    DisplayName = "Metal Facemask",       Price = 250,  Amount = 1   },
                    new ShopItem { Shortname = "ammo.rifle",        DisplayName = "5.56 Rifle Ammo",      Price = 2,    Amount = 128 },
                    new ShopItem { Shortname = "lowgradefuel",      DisplayName = "Low Grade Fuel",       Price = 2,    Amount = 100 },
                }
            };
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try { _cfg = Config.ReadObject<PluginConfig>(); if (_cfg == null) throw new Exception(); }
            catch { LoadDefaultConfig(); }
            if (_cfg.DefaultItems == null || _cfg.DefaultItems.Count == 0) LoadDefaultConfig();
            SaveConfig();
        }
        protected override void SaveConfig() => Config.WriteObject(_cfg, true);

        List<ShopItem> CloneItems(List<ShopItem> src) =>
            src.Select(i => new ShopItem { Shortname = i.Shortname, DisplayName = i.DisplayName, Price = i.Price, Amount = i.Amount }).ToList();

        // ── Data ──────────────────────────────────────────────────────────────────
        void LoadData()
        {
            try { _data = Interface.Oxide.DataFileSystem.ReadObject<SavedData>(Name) ?? new SavedData(); }
            catch { _data = new SavedData(); }
            if (_data.Markets   == null) _data.Markets   = new List<Market>();
            if (_data.ItemStats == null) _data.ItemStats = new Dictionary<string, ItemStat>();
            if (_data.Players   == null) _data.Players   = new Dictionary<string, PlayerStat>();
            // Migrate any market missing a shop → seed with defaults
            foreach (var m in _data.Markets)
            {
                if (m.Items == null || m.Items.Count == 0) m.Items = CloneItems(_cfg.DefaultItems);
                if (string.IsNullOrEmpty(m.CurrencyShortname)) { m.CurrencyShortname = _cfg.DefaultCurrencyShortname; m.CurrencyName = _cfg.DefaultCurrencyName; }
            }
        }
        void SaveData() => Interface.Oxide.DataFileSystem.WriteObject(Name, _data);

        PlayerStat PlayerStatFor(BasePlayer p)
        {
            PlayerStat st;
            if (!_data.Players.TryGetValue(p.UserIDString, out st)) { st = new PlayerStat(); _data.Players[p.UserIDString] = st; }
            st.Name = p.displayName;
            return st;
        }

        // ── Lifecycle ─────────────────────────────────────────────────────────────
        void Init()
        {
            permission.RegisterPermission(PermAdmin, this);
            permission.RegisterPermission(PermUse, this);
            cmd.AddChatCommand("bm", this, "CmdBlackMarket");
            LoadData();
            // Hot-reload case: the server is already running (world loaded), so
            // OnServerInitialized may not fire again — respawn shortly after load.
            timer.Once(1.5f, () => { if (TerrainMeta.Size.x > 0f) EnsureSpawned(); });
        }

        void OnServerInitialized() => EnsureSpawned();

        void EnsureSpawned()
        {
            if (_npcs.Count > 0) return; // already spawned this load
            SpawnAll();
        }

        void SpawnAll()
        {
            foreach (var m in _data.Markets)
            {
                var rot = Quaternion.Euler(0f, m.Yaw, 0f);
                SpawnNpc(new Vector3(m.X, m.Y, m.Z), rot);
                if (m.Sign) SpawnSign(m, rot);
            }
        }

        void KillAll()
        {
            foreach (var e in _npcs.ToList())  if (e != null && !e.IsDestroyed) e.Kill();
            foreach (var e in _signs.ToList()) if (e != null && !e.IsDestroyed) e.Kill();
            _npcs.Clear();
            _signs.Clear();
        }

        void Unload()
        {
            KillAll();
            foreach (var p in BasePlayer.activePlayerList) CuiHelper.DestroyUi(p, UiName);
        }

        void SpawnNpc(Vector3 pos, Quaternion rot)
        {
            var ent = GameManager.server.CreateEntity(NpcPrefab, pos, rot);
            if (ent == null) { PrintWarning("Failed to create Black Market NPC (prefab missing?)."); return; }
            ent.enableSaving = false;
            ent.Spawn();
            _npcs.Add(ent);
        }

        void SpawnSign(Market m, Quaternion rot)
        {
            // Place the sign just beside the NPC, raised to eye height, facing the same way.
            Vector3 offset = rot * new Vector3(1.0f, 1.1f, 0f);
            var sign = GameManager.server.CreateEntity(SignPrefab, new Vector3(m.X, m.Y, m.Z) + offset, rot) as Signage;
            if (sign == null) { PrintWarning("Failed to create Black Market sign (prefab missing?)."); return; }
            sign.enableSaving = false;
            sign.Spawn();
            _signs.Add(sign);
            if (!string.IsNullOrEmpty(m.SignText)) ApplySignText(sign, m.SignText);
        }

        void ApplySignText(Signage sign, string text)
        {
            byte[] png;
            try { png = RenderTextPng(text, 256, 128); }
            catch (Exception e) { PrintWarning("Sign text could not be rendered on this server: " + e.Message); return; }
            if (png == null) return;
            try
            {
                if (sign.textureIDs != null)
                    for (int i = 0; i < sign.textureIDs.Length; i++)
                        if (sign.textureIDs[i] != 0) { FileStorage.server.Remove(sign.textureIDs[i], FileStorage.Type.png, sign.net.ID); sign.textureIDs[i] = 0; }
                uint id = FileStorage.server.Store(png, FileStorage.Type.png, sign.net.ID);
                if (sign.textureIDs == null || sign.textureIDs.Length == 0) sign.textureIDs = new uint[1];
                sign.textureIDs[0] = id;
                sign.SetFlag(BaseEntity.Flags.Locked, true);
                sign.SendNetworkUpdate();
            }
            catch (Exception e) { PrintWarning("Failed to apply sign texture: " + e.Message); }
        }

        byte[] RenderTextPng(string text, int w, int h)
        {
            using (var bmp = new System.Drawing.Bitmap(w, h))
            using (var g = System.Drawing.Graphics.FromImage(bmp))
            {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                g.Clear(System.Drawing.Color.FromArgb(18, 20, 18));
                using (var font = new System.Drawing.Font("Arial", 26, System.Drawing.FontStyle.Bold))
                using (var brush = new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(140, 210, 90)))
                using (var sf = new System.Drawing.StringFormat { Alignment = System.Drawing.StringAlignment.Center, LineAlignment = System.Drawing.StringAlignment.Center })
                {
                    g.DrawString(text, font, brush, new System.Drawing.RectangleF(4, 4, w - 8, h - 8), sf);
                }
                using (var ms = new System.IO.MemoryStream()) { bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png); return ms.ToArray(); }
            }
        }

        void RespawnAll()
        {
            KillAll();
            SpawnAll();
        }

        bool IsMarketNpc(BaseEntity ent) => ent != null && _npcs.Contains(ent);

        object OnEntityTakeDamage(BaseCombatEntity entity, HitInfo info)
        {
            if (IsMarketNpc(entity))
            {
                if (info != null) info.damageTypes?.ScaleAll(0f);
                return true;
            }
            return null;
        }

        // ── Interaction ───────────────────────────────────────────────────────────
        void OnPlayerInput(BasePlayer player, InputState input)
        {
            if (player == null || input == null) return;
            if (!input.WasJustPressed(BUTTON.USE)) return;
            if (_cfg.RequireUsePermission && !permission.UserHasPermission(player.UserIDString, PermUse)) return;

            RaycastHit hit;
            if (!Physics.Raycast(player.eyes.HeadRay(), out hit, _cfg.InteractDistance)) return;
            var ent = hit.GetEntity();
            if (!IsMarketNpc(ent)) return;

            int idx = _npcs.IndexOf(ent);
            if (idx < 0 || idx >= _data.Markets.Count) return;

            PlayerStatFor(player).Opens++;
            SaveData();
            OpenShop(player, idx);
        }

        // ── Admin chat command ──────────────────────────────────────────────────
        [ChatCommand("blackmarket")]
        void CmdBlackMarket(BasePlayer player, string command, string[] args)
        {
            if (!IsAdmin(player)) { Msg(player, "You don't have permission."); return; }
            string sub = args.Length > 0 ? args[0].ToLower() : "help";
            switch (sub)
            {
                case "place":
                {
                    var pos = player.transform.position;
                    float yaw = player.eyes != null ? player.eyes.rotation.eulerAngles.y + 180f : 0f;
                    var m = new Market {
                        X = pos.x, Y = pos.y, Z = pos.z, Yaw = yaw,
                        CurrencyShortname = _cfg.DefaultCurrencyShortname,
                        CurrencyName = _cfg.DefaultCurrencyName,
                        Items = CloneItems(_cfg.DefaultItems)
                    };
                    _data.Markets.Add(m);
                    SaveData();
                    SpawnNpc(pos, Quaternion.Euler(0f, yaw, 0f));
                    Msg(player, "Black Market NPC placed with the default shop. Edit it in the MyRcon Black Market page.");
                    break;
                }
                case "remove":
                {
                    int best = -1; float bestD = float.MaxValue;
                    for (int i = 0; i < _npcs.Count; i++)
                    {
                        var n = _npcs[i];
                        if (n == null || n.IsDestroyed) continue;
                        float d = Vector3.Distance(n.transform.position, player.transform.position);
                        if (d < bestD) { bestD = d; best = i; }
                    }
                    if (best < 0 || bestD > 8f) { Msg(player, "No Black Market NPC within 8m."); return; }
                    if (best < _data.Markets.Count) _data.Markets.RemoveAt(best);
                    SaveData();
                    RespawnAll();
                    Msg(player, "Removed the nearest Black Market NPC.");
                    break;
                }
                case "list":
                    Msg(player, string.Format("{0} Black Market NPC(s) placed.", _data.Markets.Count));
                    break;
                default:
                    Msg(player, "Commands:\n/bm place — place an NPC (default shop)\n/bm remove — remove nearest NPC\n/bm list — count placed NPCs");
                    break;
            }
        }

        // ── Shop UI ─────────────────────────────────────────────────────────────
        void OpenShop(BasePlayer player, int marketIdx)
        {
            if (marketIdx < 0 || marketIdx >= _data.Markets.Count) return;
            var market = _data.Markets[marketIdx];
            int balance = CurrencyAmount(player, market);

            CuiHelper.DestroyUi(player, UiName);
            var ui = new CuiElementContainer();

            ui.Add(new CuiPanel { Image = { Color = "0 0 0 0.75" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, CursorEnabled = true }, "Overlay", UiName);
            ui.Add(new CuiPanel { Image = { Color = "0.12 0.13 0.12 0.99" }, RectTransform = { AnchorMin = "0.31 0.18", AnchorMax = "0.69 0.82" } }, UiName, "BM_W");

            ui.Add(new CuiPanel { Image = { Color = "0.16 0.18 0.16 1" }, RectTransform = { AnchorMin = "0 0.92", AnchorMax = "1 1" } }, "BM_W", "BM_H");
            string title = market.ShowName && !string.IsNullOrEmpty(market.Name) ? market.Name.ToUpper() : "BLACK MARKET";
            ui.Add(new CuiLabel { Text = { Text = title, FontSize = 16, Align = TextAnchor.MiddleLeft, Color = "0.55 0.85 0.45 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.03 0", AnchorMax = "0.7 1" } }, "BM_H");
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}: {1:N0}", market.CurrencyName, balance), FontSize = 12, Align = TextAnchor.MiddleRight, Color = "0.85 0.88 0.85 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.55 0", AnchorMax = "0.88 1" } }, "BM_H");
            ui.Add(new CuiButton { Button = { Command = "mrbm.close", Color = "0.55 0.18 0.16 1" }, RectTransform = { AnchorMin = "0.9 0.12", AnchorMax = "0.985 0.88" }, Text = { Text = "X", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = "1 0.7 0.7 1" } }, "BM_H");

            int max = Math.Min(market.Items.Count, 11);
            float top = 0.90f; const float rh = 0.072f; const float rg = 0.008f;
            for (int i = 0; i < max; i++)
            {
                var it = market.Items[i];
                float y1 = top - i * (rh + rg);
                float y0 = y1 - rh;
                string rn = "BM_R" + i;
                bool canAfford = balance >= it.Price;
                ui.Add(new CuiPanel { Image = { Color = "0.16 0.18 0.16 1" }, RectTransform = { AnchorMin = string.Format("0.03 {0:F3}", y0), AnchorMax = string.Format("0.97 {0:F3}", y1) } }, "BM_W", rn);

                // Item icon (rendered from the game's item definition)
                var rowDef = ItemManager.FindItemDefinition(it.Shortname);
                if (rowDef != null)
                    ui.Add(new CuiElement {
                        Parent = rn,
                        Components = {
                            new CuiImageComponent { ItemId = rowDef.itemid },
                            new CuiRectTransformComponent { AnchorMin = "0.022 0.14", AnchorMax = "0.10 0.86" }
                        }
                    });

                ui.Add(new CuiLabel { Text = { Text = ItemLabel(it), FontSize = 12, Align = TextAnchor.MiddleLeft, Color = "0.92 0.93 0.92 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.12 0", AnchorMax = "0.55 1" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = string.Format("x{0}", it.Amount), FontSize = 11, Align = TextAnchor.MiddleCenter, Color = "0.7 0.74 0.7 1" }, RectTransform = { AnchorMin = "0.55 0", AnchorMax = "0.66 1" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = string.Format("{0:N0}", it.Price), FontSize = 12, Align = TextAnchor.MiddleRight, Color = canAfford ? "0.55 0.85 0.45 1" : "0.8 0.5 0.45 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.66 0", AnchorMax = "0.80 1" } }, rn);
                ui.Add(new CuiButton {
                    Button = { Command = canAfford ? string.Format("mrbm.buy {0} {1}", marketIdx, i) : "", Color = canAfford ? "0.22 0.45 0.24 1" : "0.22 0.23 0.22 1" },
                    RectTransform = { AnchorMin = "0.82 0.14", AnchorMax = "0.985 0.86" },
                    Text = { Text = canAfford ? "BUY" : "—", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = canAfford ? "1 1 1 1" : "0.5 0.5 0.5 1", Font = "robotocondensed-bold.ttf" }
                }, rn);
            }

            CuiHelper.AddUi(player, ui);
        }

        [ConsoleCommand("mrbm.close")]
        void CmdClose(ConsoleSystem.Arg arg)
        {
            var p = arg.Player(); if (p == null) return;
            CuiHelper.DestroyUi(p, UiName);
        }

        [ConsoleCommand("mrbm.buy")]
        void CmdBuy(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null || !arg.HasArgs()) return;
            int marketIdx = arg.GetInt(0, -1);
            int itemIdx   = arg.GetInt(1, -1);
            if (marketIdx < 0 || marketIdx >= _data.Markets.Count) return;
            var market = _data.Markets[marketIdx];
            if (itemIdx < 0 || itemIdx >= market.Items.Count) return;

            var it = market.Items[itemIdx];
            var def = ItemManager.FindItemDefinition(it.Shortname);
            if (def == null) { Msg(player, "That item is unavailable."); return; }

            int balance = CurrencyAmount(player, market);
            if (balance < it.Price) { Msg(player, string.Format("Not enough {0}.", market.CurrencyName)); return; }

            TakeCurrency(player, market, it.Price);
            var give = ItemManager.Create(def, it.Amount);
            if (give == null) { Msg(player, "Purchase failed."); return; }
            player.GiveItem(give);

            ItemStat istat;
            if (!_data.ItemStats.TryGetValue(it.Shortname, out istat)) { istat = new ItemStat(); _data.ItemStats[it.Shortname] = istat; }
            istat.Count++; istat.Qty += it.Amount; istat.Revenue += it.Price;
            var pstat = PlayerStatFor(player);
            pstat.Purchases++; pstat.Spent += it.Price;
            SaveData();

            Msg(player, string.Format("Purchased {0} x{1} for {2:N0} {3}.", ItemLabel(it), it.Amount, it.Price, market.CurrencyName));
            OpenShop(player, marketIdx);
        }

        void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player != null) CuiHelper.DestroyUi(player, UiName);
        }

        // ── RCON console commands (panel) ─────────────────────────────────────────
        bool IsServerCmd(ConsoleSystem.Arg arg)
        {
            if (arg.IsRcon) return true;
            var p = arg.Player();
            return p == null || p.IsAdmin || permission.UserHasPermission(p.UserIDString, PermAdmin);
        }

        bool ValidMarket(int idx) => idx >= 0 && idx < _data.Markets.Count;

        [ConsoleCommand("bm.getmarkets")]
        void CcGetMarkets(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                markets = _data.Markets.Select((m, i) => new {
                    index = i, x = m.X, y = m.Y, z = m.Z, name = m.Name, showName = m.ShowName,
                    sign = m.Sign, signText = m.SignText,
                    currencyShortname = m.CurrencyShortname, currencyName = m.CurrencyName,
                    items = m.Items.Select((it, j) => new { index = j, shortname = it.Shortname, displayName = it.DisplayName, price = it.Price, amount = it.Amount }).ToList()
                }).ToList()
            }));
        }

        [ConsoleCommand("bm.setnpc")]
        void CcSetNpc(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 2) { arg.ReplyWith("{\"error\":\"usage: bm.setnpc <index> <showName 0|1> [name]\"}"); return; }
            int idx = ParseInt(a[0], -1);
            if (!ValidMarket(idx)) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets[idx].ShowName = a[1] == "1" || a[1].ToLower() == "true";
            _data.Markets[idx].Name = a.Length > 2 ? string.Join(" ", a.Skip(2)) : "";
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.setsign")]
        void CcSetSign(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 2) { arg.ReplyWith("{\"error\":\"usage: bm.setsign <index> <on 0|1> [text]\"}"); return; }
            int idx = ParseInt(a[0], -1);
            if (!ValidMarket(idx)) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets[idx].Sign = a[1] == "1" || a[1].ToLower() == "true";
            _data.Markets[idx].SignText = a.Length > 2 ? string.Join(" ", a.Skip(2)) : "";
            SaveData();
            RespawnAll(); // re-place/re-text signs
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.setcurrency")]
        void CcSetCurrency(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 2) { arg.ReplyWith("{\"error\":\"usage: bm.setcurrency <marketIdx> <shortname> [name]\"}"); return; }
            int idx = ParseInt(a[0], -1);
            if (!ValidMarket(idx)) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets[idx].CurrencyShortname = a[1];
            _data.Markets[idx].CurrencyName = a.Length > 2 ? string.Join(" ", a.Skip(2)) : a[1];
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.additem")]
        void CcAddItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 4) { arg.ReplyWith("{\"error\":\"usage: bm.additem <marketIdx> <shortname> <price> <amount> [name]\"}"); return; }
            int idx = ParseInt(a[0], -1);
            if (!ValidMarket(idx)) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets[idx].Items.Add(new ShopItem {
                Shortname = a[1], Price = ParseInt(a[2], 100), Amount = ParseInt(a[3], 1),
                DisplayName = a.Length > 4 ? string.Join(" ", a.Skip(4)) : ""
            });
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.updateitem")]
        void CcUpdateItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 4) { arg.ReplyWith("{\"error\":\"usage: bm.updateitem <marketIdx> <itemIdx> <price> <amount> [name]\"}"); return; }
            int idx = ParseInt(a[0], -1), j = ParseInt(a[1], -1);
            if (!ValidMarket(idx) || j < 0 || j >= _data.Markets[idx].Items.Count) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            var it = _data.Markets[idx].Items[j];
            it.Price = ParseInt(a[2], it.Price);
            it.Amount = ParseInt(a[3], it.Amount);
            if (a.Length > 4) it.DisplayName = string.Join(" ", a.Skip(4));
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.removeitem")]
        void CcRemoveItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 2) { arg.ReplyWith("{\"error\":\"usage: bm.removeitem <marketIdx> <itemIdx>\"}"); return; }
            int idx = ParseInt(a[0], -1), j = ParseInt(a[1], -1);
            if (!ValidMarket(idx) || j < 0 || j >= _data.Markets[idx].Items.Count) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets[idx].Items.RemoveAt(j);
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.placenpc")]
        void CcPlaceNpc(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 3) { arg.ReplyWith("{\"error\":\"usage: bm.placenpc <x> <y> <z> [yaw]\"}"); return; }
            float x = ParseFloat(a[0]), y = ParseFloat(a[1]), z = ParseFloat(a[2]);
            float yaw = a.Length > 3 ? ParseFloat(a[3]) : 0f;
            _data.Markets.Add(new Market {
                X = x, Y = y, Z = z, Yaw = yaw,
                CurrencyShortname = _cfg.DefaultCurrencyShortname, CurrencyName = _cfg.DefaultCurrencyName,
                Items = CloneItems(_cfg.DefaultItems)
            });
            SaveData();
            SpawnNpc(new Vector3(x, y, z), Quaternion.Euler(0f, yaw, 0f));
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.removenpc")]
        void CcRemoveNpc(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            int idx = arg.GetInt(0, -1);
            if (!ValidMarket(idx)) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Markets.RemoveAt(idx);
            SaveData();
            RespawnAll();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.clone")]
        void CcClone(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = GetArgs(arg);
            if (a.Length < 2) { arg.ReplyWith("{\"error\":\"usage: bm.clone <srcIdx> <dstIdx>\"}"); return; }
            int src = ParseInt(a[0], -1), dst = ParseInt(a[1], -1);
            if (!ValidMarket(src) || !ValidMarket(dst) || src == dst) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            var s = _data.Markets[src]; var d = _data.Markets[dst];
            d.CurrencyShortname = s.CurrencyShortname;
            d.CurrencyName      = s.CurrencyName;
            d.Items             = CloneItems(s.Items);
            SaveData();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.getanalytics")]
        void CcGetAnalytics(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var sold = _data.ItemStats.Values.Where(s => s.Count > 0).Select(s => s.Count).ToList();
            double avg = sold.Count > 0 ? sold.Average() : 0;
            int totalSales = _data.ItemStats.Values.Sum(s => s.Count);
            int totalRevenue = _data.ItemStats.Values.Sum(s => s.Revenue);

            // Aggregate across all markets, keyed by shortname
            var names = new Dictionary<string, string>();
            foreach (var m in _data.Markets)
                foreach (var it in m.Items)
                    if (!names.ContainsKey(it.Shortname)) names[it.Shortname] = ItemLabel(it);

            var items = _data.ItemStats.Select(kv => {
                string sn = kv.Key; var st = kv.Value;
                string suggestion;
                if (st.Count == 0)                          suggestion = "No sales — consider lowering price or removing.";
                else if (st.Count >= Math.Max(5, avg * 1.5)) suggestion = "Top seller — consider raising the price.";
                else                                         suggestion = "Selling normally.";
                return new { shortname = sn, displayName = names.ContainsKey(sn) ? names[sn] : sn, count = st.Count, qty = st.Qty, revenue = st.Revenue, suggestion };
            }).OrderByDescending(x => x.count).ToList();

            arg.ReplyWith(JsonConvert.SerializeObject(new { totalSales, totalRevenue, items }));
        }

        [ConsoleCommand("bm.getbuyers")]
        void CcGetBuyers(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var buyers = _data.Players.Where(kv => kv.Value.Purchases > 0)
                .Select(kv => new { steamId = kv.Key, name = kv.Value.Name, purchases = kv.Value.Purchases, spent = kv.Value.Spent })
                .OrderByDescending(b => b.spent).ToList();
            var lookers = _data.Players.Where(kv => kv.Value.Purchases == 0 && kv.Value.Opens > 0)
                .Select(kv => new { steamId = kv.Key, name = kv.Value.Name, opens = kv.Value.Opens })
                .OrderByDescending(l => l.opens).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { buyers, lookers }));
        }

        static string[] GetArgs(ConsoleSystem.Arg arg) =>
            arg.HasArgs() ? System.Array.ConvertAll(arg.Args, x => x.ToString()) : new string[0];
        static int   ParseInt(string s, int def) { int v;   return int.TryParse(s, out v) ? v : def; }
        static float ParseFloat(string s)        { float v; return float.TryParse(s, out v) ? v : 0f; }

        // ── Currency helpers (per-market) ─────────────────────────────────────────
        int CurrencyAmount(BasePlayer p, Market market)
        {
            var def = ItemManager.FindItemDefinition(market.CurrencyShortname);
            if (def == null || p?.inventory == null) return 0;
            return p.inventory.GetAmount(def.itemid);
        }

        void TakeCurrency(BasePlayer p, Market market, int amount)
        {
            var def = ItemManager.FindItemDefinition(market.CurrencyShortname);
            if (def == null) return;
            p.inventory.Take(null, def.itemid, amount);
            p.SendNetworkUpdate();
        }

        // ── Helpers ───────────────────────────────────────────────────────────────
        bool IsAdmin(BasePlayer p) =>
            p != null && (p.IsAdmin || permission.UserHasPermission(p.UserIDString, PermAdmin));

        string ItemLabel(ShopItem it)
        {
            if (!string.IsNullOrEmpty(it.DisplayName)) return it.DisplayName;
            var def = ItemManager.FindItemDefinition(it.Shortname);
            return def != null && def.displayName != null ? def.displayName.english : it.Shortname;
        }

        void Msg(BasePlayer p, string m) =>
            SendReply(p, string.Format("<color=#8CCB5A>Black Market</color>: {0}", m));
    }
}
