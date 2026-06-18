using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconBlackMarket", "MyRcon", "1.0.1")]
    [Description("Interactable Black Market NPC shop — buy items with scrap. Invincible, non-combat NPCs placed by admins.")]
    public class MyRconBlackMarket : RustPlugin
    {
        const string PermAdmin = "myrconblackmarket.admin";
        const string PermUse   = "myrconblackmarket.use";
        const string NpcPrefab = "assets/prefabs/npc/bandit/shopkeepers/bandit_shopkeeper.prefab";
        const string UiName    = "MyRconBlackMarket_UI";

        PluginConfig _cfg;
        SavedData    _data;
        readonly List<BaseEntity> _npcs = new List<BaseEntity>();

        // ── Config ──────────────────────────────────────────────────────────────
        class ShopItem
        {
            public string Shortname   = "";
            public string DisplayName = "";
            public int    Price       = 100; // in currency units
            public int    Amount      = 1;
        }

        class PluginConfig
        {
            public string CurrencyShortname    = "scrap";
            public string CurrencyName         = "Scrap";
            public float  InteractDistance     = 3.5f;
            public bool   RequireUsePermission = false;
            public List<ShopItem> Items        = new List<ShopItem>();
        }

        protected override void LoadDefaultConfig()
        {
            _cfg = new PluginConfig
            {
                Items = new List<ShopItem>
                {
                    new ShopItem { Shortname = "rifle.ak",          DisplayName = "Assault Rifle",        Price = 600,  Amount = 1   },
                    new ShopItem { Shortname = "explosive.timed",   DisplayName = "Timed Explosive (C4)", Price = 1200, Amount = 1   },
                    new ShopItem { Shortname = "metal.facemask",    DisplayName = "Metal Facemask",       Price = 250,  Amount = 1   },
                    new ShopItem { Shortname = "metal.plate.torso", DisplayName = "Metal Chestplate",     Price = 250,  Amount = 1   },
                    new ShopItem { Shortname = "ammo.rifle",        DisplayName = "5.56 Rifle Ammo",      Price = 2,    Amount = 128 },
                    new ShopItem { Shortname = "lowgradefuel",      DisplayName = "Low Grade Fuel",       Price = 2,    Amount = 100 },
                    new ShopItem { Shortname = "targeting.computer",DisplayName = "Targeting Computer",   Price = 300,  Amount = 1   },
                    new ShopItem { Shortname = "cctv.camera",       DisplayName = "CCTV Camera",          Price = 150,  Amount = 1   },
                }
            };
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try { _cfg = Config.ReadObject<PluginConfig>(); if (_cfg == null) throw new Exception(); }
            catch { LoadDefaultConfig(); }
            SaveConfig();
        }

        protected override void SaveConfig() => Config.WriteObject(_cfg, true);

        // ── Saved NPC placements ──────────────────────────────────────────────────
        class NpcPos { public float X, Y, Z, Yaw; }
        class SavedData { public List<NpcPos> Npcs = new List<NpcPos>(); }

        void LoadData()
        {
            try { _data = Interface.Oxide.DataFileSystem.ReadObject<SavedData>(Name) ?? new SavedData(); }
            catch { _data = new SavedData(); }
            if (_data.Npcs == null) _data.Npcs = new List<NpcPos>();
        }
        void SaveData() => Interface.Oxide.DataFileSystem.WriteObject(Name, _data);

        // ── Lifecycle ─────────────────────────────────────────────────────────────
        void Init()
        {
            permission.RegisterPermission(PermAdmin, this);
            permission.RegisterPermission(PermUse, this);
            LoadData();
        }

        void OnServerInitialized()
        {
            foreach (var n in _data.Npcs)
                SpawnNpc(new Vector3(n.X, n.Y, n.Z), Quaternion.Euler(0f, n.Yaw, 0f));
        }

        void Unload()
        {
            foreach (var ent in _npcs.ToList())
                if (ent != null && !ent.IsDestroyed) ent.Kill();
            _npcs.Clear();
            foreach (var p in BasePlayer.activePlayerList) CuiHelper.DestroyUi(p, UiName);
        }

        // ── NPC spawn / invincibility ───────────────────────────────────────────
        void SpawnNpc(Vector3 pos, Quaternion rot)
        {
            var ent = GameManager.server.CreateEntity(NpcPrefab, pos, rot);
            if (ent == null) { PrintWarning("Failed to create Black Market NPC (prefab missing?)."); return; }
            ent.enableSaving = false; // we respawn from our own data; don't double up in the server save
            ent.Spawn();
            _npcs.Add(ent);
        }

        bool IsMarketNpc(BaseEntity ent) => ent != null && _npcs.Contains(ent);

        // Cancel all damage to our NPCs — they cannot be killed.
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

            OpenShop(player);
        }

        // ── Admin chat command ──────────────────────────────────────────────────
        [ChatCommand("blackmarket")]
        void CmdBlackMarket(BasePlayer player, string cmd, string[] args)
        {
            if (!IsAdmin(player)) { Msg(player, "You don't have permission."); return; }

            string sub = args.Length > 0 ? args[0].ToLower() : "help";
            switch (sub)
            {
                case "place":
                {
                    var pos = player.transform.position;
                    float yaw = player.eyes != null ? player.eyes.rotation.eulerAngles.y + 180f : 0f; // face the admin
                    SpawnNpc(pos, Quaternion.Euler(0f, yaw, 0f));
                    _data.Npcs.Add(new NpcPos { X = pos.x, Y = pos.y, Z = pos.z, Yaw = yaw });
                    SaveData();
                    Msg(player, "Black Market NPC placed where you're standing.");
                    break;
                }
                case "remove":
                {
                    BaseEntity nearest = null; float best = float.MaxValue;
                    foreach (var n in _npcs)
                    {
                        if (n == null || n.IsDestroyed) continue;
                        float d = Vector3.Distance(n.transform.position, player.transform.position);
                        if (d < best) { best = d; nearest = n; }
                    }
                    if (nearest == null || best > 8f) { Msg(player, "No Black Market NPC within 8m."); return; }
                    var np = nearest.transform.position;
                    _data.Npcs.RemoveAll(x => Mathf.Abs(x.X - np.x) < 0.6f && Mathf.Abs(x.Z - np.z) < 0.6f);
                    SaveData();
                    _npcs.Remove(nearest);
                    if (!nearest.IsDestroyed) nearest.Kill();
                    Msg(player, "Removed the nearest Black Market NPC.");
                    break;
                }
                case "list":
                    Msg(player, string.Format("{0} Black Market NPC(s) placed.", _data.Npcs.Count));
                    break;
                default:
                    Msg(player, "Commands:\n/blackmarket place — place an NPC where you stand\n/blackmarket remove — remove nearest NPC\n/blackmarket list — count placed NPCs");
                    break;
            }
        }

        // ── Shop UI ─────────────────────────────────────────────────────────────
        void OpenShop(BasePlayer player)
        {
            int balance = CurrencyAmount(player);
            CuiHelper.DestroyUi(player, UiName);
            var ui = new CuiElementContainer();

            // Backdrop
            ui.Add(new CuiPanel {
                Image = { Color = "0 0 0 0.75" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                CursorEnabled = true
            }, "Overlay", UiName);

            // Window
            ui.Add(new CuiPanel {
                Image = { Color = "0.12 0.13 0.12 0.99" },
                RectTransform = { AnchorMin = "0.31 0.18", AnchorMax = "0.69 0.82" }
            }, UiName, "BM_W");

            // Header
            ui.Add(new CuiPanel { Image = { Color = "0.16 0.18 0.16 1" }, RectTransform = { AnchorMin = "0 0.92", AnchorMax = "1 1" } }, "BM_W", "BM_H");
            ui.Add(new CuiLabel { Text = { Text = "BLACK MARKET", FontSize = 16, Align = TextAnchor.MiddleLeft, Color = "0.55 0.85 0.45 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.03 0", AnchorMax = "0.7 1" } }, "BM_H");
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}: {1:N0}", _cfg.CurrencyName, balance), FontSize = 12, Align = TextAnchor.MiddleRight, Color = "0.85 0.88 0.85 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.55 0", AnchorMax = "0.88 1" } }, "BM_H");
            ui.Add(new CuiButton { Button = { Command = "mrbm.close", Color = "0.55 0.18 0.16 1" }, RectTransform = { AnchorMin = "0.9 0.12", AnchorMax = "0.985 0.88" }, Text = { Text = "X", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = "1 0.7 0.7 1" } }, "BM_H");

            // Item rows
            int max = Math.Min(_cfg.Items.Count, 11);
            float top = 0.90f; const float rh = 0.072f; const float rg = 0.008f;
            for (int i = 0; i < max; i++)
            {
                var it = _cfg.Items[i];
                float y1 = top - i * (rh + rg);
                float y0 = y1 - rh;
                string rn = "BM_R" + i;
                bool canAfford = balance >= it.Price;
                ui.Add(new CuiPanel { Image = { Color = "0.16 0.18 0.16 1" }, RectTransform = { AnchorMin = string.Format("0.03 {0:F3}", y0), AnchorMax = string.Format("0.97 {0:F3}", y1) } }, "BM_W", rn);
                ui.Add(new CuiLabel { Text = { Text = ItemLabel(it), FontSize = 12, Align = TextAnchor.MiddleLeft, Color = "0.92 0.93 0.92 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.03 0", AnchorMax = "0.55 1" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = string.Format("x{0}", it.Amount), FontSize = 11, Align = TextAnchor.MiddleCenter, Color = "0.7 0.74 0.7 1" }, RectTransform = { AnchorMin = "0.55 0", AnchorMax = "0.66 1" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = string.Format("{0:N0}", it.Price), FontSize = 12, Align = TextAnchor.MiddleRight, Color = canAfford ? "0.55 0.85 0.45 1" : "0.8 0.5 0.45 1", Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.66 0", AnchorMax = "0.80 1" } }, rn);
                ui.Add(new CuiButton {
                    Button = { Command = canAfford ? "mrbm.buy " + i : "", Color = canAfford ? "0.22 0.45 0.24 1" : "0.22 0.23 0.22 1" },
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
            int idx = arg.GetInt(0, -1);
            if (idx < 0 || idx >= _cfg.Items.Count) return;

            var it = _cfg.Items[idx];
            var def = ItemManager.FindItemDefinition(it.Shortname);
            if (def == null) { Msg(player, "That item is unavailable."); return; }

            int balance = CurrencyAmount(player);
            if (balance < it.Price) { Msg(player, string.Format("Not enough {0}.", _cfg.CurrencyName)); return; }

            TakeCurrency(player, it.Price);
            var give = ItemManager.Create(def, it.Amount);
            if (give == null) { Msg(player, "Purchase failed."); return; }
            player.GiveItem(give);
            Msg(player, string.Format("Purchased {0} x{1} for {2:N0} {3}.", ItemLabel(it), it.Amount, it.Price, _cfg.CurrencyName));
            OpenShop(player); // refresh balance
        }

        void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player != null) CuiHelper.DestroyUi(player, UiName);
        }

        // ── RCON console commands (MyRCON Black Market panel) ─────────────────────
        bool IsServerCmd(ConsoleSystem.Arg arg)
        {
            if (arg.IsRcon) return true;
            var p = arg.Player();
            return p == null || p.IsAdmin || permission.UserHasPermission(p.UserIDString, PermAdmin);
        }

        void RespawnAll()
        {
            foreach (var e in _npcs.ToList())
                if (e != null && !e.IsDestroyed) e.Kill();
            _npcs.Clear();
            foreach (var n in _data.Npcs)
                SpawnNpc(new Vector3(n.X, n.Y, n.Z), Quaternion.Euler(0f, n.Yaw, 0f));
        }

        [ConsoleCommand("bm.getconfig")]
        void CcGetConfig(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                currencyShortname = _cfg.CurrencyShortname,
                currencyName      = _cfg.CurrencyName,
                interactDistance  = _cfg.InteractDistance,
                requireUsePermission = _cfg.RequireUsePermission,
                items = _cfg.Items.Select((it, i) => new {
                    index = i, shortname = it.Shortname, displayName = it.DisplayName, price = it.Price, amount = it.Amount
                }).ToList()
            }));
        }

        [ConsoleCommand("bm.getnpcs")]
        void CcGetNpcs(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                npcs = _data.Npcs.Select((n, i) => new { index = i, x = n.X, y = n.Y, z = n.Z, yaw = n.Yaw }).ToList()
            }));
        }

        [ConsoleCommand("bm.additem")]
        void CcAddItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = arg.Args ?? new string[0];
            if (a.Length < 3) { arg.ReplyWith("{\"error\":\"usage: bm.additem <shortname> <price> <amount> [name]\"}"); return; }
            var it = new ShopItem {
                Shortname   = a[0],
                Price       = ParseInt(a[1], 100),
                Amount      = ParseInt(a[2], 1),
                DisplayName = a.Length > 3 ? string.Join(" ", a.Skip(3)) : ""
            };
            _cfg.Items.Add(it);
            SaveConfig();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.updateitem")]
        void CcUpdateItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = arg.Args ?? new string[0];
            if (a.Length < 3) { arg.ReplyWith("{\"error\":\"usage: bm.updateitem <index> <price> <amount> [name]\"}"); return; }
            int idx = ParseInt(a[0], -1);
            if (idx < 0 || idx >= _cfg.Items.Count) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _cfg.Items[idx].Price  = ParseInt(a[1], _cfg.Items[idx].Price);
            _cfg.Items[idx].Amount = ParseInt(a[2], _cfg.Items[idx].Amount);
            if (a.Length > 3) _cfg.Items[idx].DisplayName = string.Join(" ", a.Skip(3));
            SaveConfig();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.removeitem")]
        void CcRemoveItem(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            int idx = arg.GetInt(0, -1);
            if (idx < 0 || idx >= _cfg.Items.Count) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _cfg.Items.RemoveAt(idx);
            SaveConfig();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.setcurrency")]
        void CcSetCurrency(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = arg.Args ?? new string[0];
            if (a.Length < 1) { arg.ReplyWith("{\"error\":\"usage: bm.setcurrency <shortname> [name]\"}"); return; }
            _cfg.CurrencyShortname = a[0];
            _cfg.CurrencyName = a.Length > 1 ? string.Join(" ", a.Skip(1)) : a[0];
            SaveConfig();
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.placenpc")]
        void CcPlaceNpc(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            var a = arg.Args ?? new string[0];
            if (a.Length < 3) { arg.ReplyWith("{\"error\":\"usage: bm.placenpc <x> <y> <z> [yaw]\"}"); return; }
            float x = ParseFloat(a[0]), y = ParseFloat(a[1]), z = ParseFloat(a[2]);
            float yaw = a.Length > 3 ? ParseFloat(a[3]) : 0f;
            _data.Npcs.Add(new NpcPos { X = x, Y = y, Z = z, Yaw = yaw });
            SaveData();
            SpawnNpc(new Vector3(x, y, z), Quaternion.Euler(0f, yaw, 0f));
            arg.ReplyWith("{\"success\":true}");
        }

        [ConsoleCommand("bm.removenpc")]
        void CcRemoveNpc(ConsoleSystem.Arg arg)
        {
            if (!IsServerCmd(arg)) return;
            int idx = arg.GetInt(0, -1);
            if (idx < 0 || idx >= _data.Npcs.Count) { arg.ReplyWith("{\"error\":\"bad index\"}"); return; }
            _data.Npcs.RemoveAt(idx);
            SaveData();
            RespawnAll();
            arg.ReplyWith("{\"success\":true}");
        }

        static int   ParseInt(string s, int def)   { int v;   return int.TryParse(s, out v) ? v : def; }
        static float ParseFloat(string s)          { float v; return float.TryParse(s, out v) ? v : 0f; }

        // ── Currency helpers ──────────────────────────────────────────────────────
        int CurrencyAmount(BasePlayer p)
        {
            var def = ItemManager.FindItemDefinition(_cfg.CurrencyShortname);
            if (def == null || p?.inventory == null) return 0;
            return p.inventory.GetAmount(def.itemid);
        }

        void TakeCurrency(BasePlayer p, int amount)
        {
            var def = ItemManager.FindItemDefinition(_cfg.CurrencyShortname);
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
