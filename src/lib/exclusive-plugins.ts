// MyRcon Exclusive Plugins — bundled .cs plugin registry.
// Plugin content is embedded here so the app ships self-contained.
// Users install them to their server via SFTP from the Exclusive Plugins page.

export type ExclusivePlugin = {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  tags: string[];
  filename: string;        // what the .cs file is named on the server
  defaultPath: string;     // relative to sftpRootPath (or sftpDefaultPluginPath parent)
  permissions: string[];   // Oxide/Carbon permission nodes this plugin uses
  previewItems: string[];  // item shortnames shown as preview images (like F1 menu)
  content: string;         // the actual .cs source
};

// ─────────────────────────────────────────────────────────────────────────────
//  Admin Panel Plugin
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_PANEL_CS = `using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.3.2")]
    [Description("MyRcon exclusive in-game admin dashboard")]
    public class MyRconAdminPanel : RustPlugin
    {
        // ── UI layer names ────────────────────────────────────────────────────
        private const string PermUse  = "myrconadminpanel.use";
        private const string UiMain   = "MRAP_Main";
        private const string UiBody   = "MRAP_Body";

        // ── Screens ───────────────────────────────────────────────────────────
        private const string ScrHome    = "home";
        private const string ScrGive    = "give";
        private const string ScrPlayers = "players";
        private const string ScrServer  = "server";

        // ── Palette ───────────────────────────────────────────────────────────
        private const string CBg        = "0.06 0.07 0.09 0.98";
        private const string CPanel     = "0.07 0.085 0.105 1";
        private const string CCell      = "0.09 0.11 0.135 1";
        private const string CCellSel   = "0.18 0.09 0.02 1";
        private const string CDivider   = "1 1 1 0.06";
        private const string COrange    = "0.94 0.42 0.06 1";
        private const string COrangeDim = "0.94 0.42 0.06 0.18";
        private const string CBlue      = "0.18 0.45 0.82 1";
        private const string CBlueDim   = "0.18 0.45 0.82 0.18";
        private const string CGreen     = "0.22 0.65 0.32 1";
        private const string CGreenDim  = "0.22 0.65 0.32 0.18";
        private const string CRed       = "0.75 0.18 0.12 1";
        private const string CRedDim    = "0.75 0.18 0.12 0.2";
        private const string CText      = "0.92 0.93 0.95 1";
        private const string CMuted     = "0.52 0.57 0.63 1";
        private const string CDim       = "0.3 0.35 0.4 1";
        private const string CBtnOff    = "0.1 0.13 0.17 1";
        private const string CCooldown  = "0.55 0.18 0.08 1";

        // ── Rate limiting ─────────────────────────────────────────────────────
        private const double GiveCooldownSecs = 2.0;
        private const double DrawThrottleMs   = 200.0;

        // ── Item catalogue ────────────────────────────────────────────────────
        private const int GridCols = 6;
        private const int GridRows = 4;
        private const int PerPage  = GridCols * GridRows;

        private static readonly Dictionary<string, List<string>> Categories =
            new Dictionary<string, List<string>>
        {
            ["Weapons"] = new List<string> {
                "rifle.ak","rifle.bolt","rifle.lr300","rifle.m39","rifle.semiauto",
                "lmg.m249","smg.mp5","smg.thompson","smg.2",
                "shotgun.pump","shotgun.spas12","shotgun.double","shotgun.waterpipe",
                "pistol.m92","pistol.python","pistol.revolver","pistol.semiauto","pistol.eoka",
                "bow.hunting","bow.compound","crossbow","rocket.launcher",
                "multiplegrenadelauncher","flamethrower","knife.combat","mace","spear.wooden"
            },
            ["Ammo"] = new List<string> {
                "ammo.rifle","ammo.rifle.explosive","ammo.rifle.hv","ammo.rifle.incendiary",
                "ammo.pistol","ammo.pistol.hv","ammo.pistol.fire",
                "ammo.shotgun","ammo.shotgun.slug","ammo.shotgun.fire","ammo.handmade.shell",
                "arrow.wooden","arrow.hv","arrow.fire",
                "ammo.rocket.basic","ammo.rocket.hv","ammo.rocket.fire",
                "40mm.grenade.he","40mm.grenade.smoke"
            },
            ["Explosives"] = new List<string> {
                "explosive.timed","explosive.satchel","grenade.f1","grenade.beancan",
                "surveycharge","gunpowder","explosives"
            },
            ["Medical"] = new List<string> {
                "syringe.medical","bandage","largemedkit","antiradpills"
            },
            ["Resources"] = new List<string> {
                "wood","stones","metal.ore","sulfur.ore","hq.metal.ore",
                "metal.fragments","sulfur","metal.refined",
                "lowgradefuel","fat.animal","cloth","leather",
                "bone.fragments","scrap","charcoal","crude.oil"
            },
            ["Components"] = new List<string> {
                "gears","metalblade","metalspring","roadsigns","rope",
                "riflebody","semibody","smgbody","techparts",
                "tarp","sewingkit","sheetmetal","propanetank","piperifle"
            },
            ["Attire"] = new List<string> {
                "metal.facemask","metal.plate.torso","roadsign.jacket","roadsign.kilt",
                "hoodie","pants","shoes.boots","hat.helmet","riot.helmet",
                "hazmatsuit","coffeecan.helmet","jacket","tactical.gloves","nightvisiongoggles"
            },
            ["Tools"] = new List<string> {
                "hammer","building.planner","torch","flashlight.held",
                "jackhammer","chainsaw","tool.camera","wiretool","hose.tool",
                "stonehatchet","pickaxe","hatchet","icepick.salvaged"
            },
            ["Building"] = new List<string> {
                "door.hinged.wood","door.hinged.metal","door.hinged.toptier",
                "wall.frame.garagedoor","furnace","campfire",
                "workbench1","workbench2","workbench3",
                "box.wooden.large","lock.code","lock.key",
                "furnace.large","refinery.small","turret","sleepingbag","bed"
            },
            ["Food"] = new List<string> {
                "apple","blueberries","mushroom","corn","pumpkin",
                "chicken.cooked","can.beans","can.tuna",
                "water.bottle","water.jug","fish.cooked","bearmeat.cooked","wolfmeat.cooked"
            },
            ["Misc"] = new List<string> {
                "key.card.green","key.card.blue","key.card.red",
                "map","paper","supply.signal","targeting.computer","fun.guitar"
            }
        };

        private static readonly List<string> AllCats;
        static MyRconAdminPanel() { AllCats = new List<string> { "All" }; AllCats.AddRange(Categories.Keys); }

        // ── Per-player state ──────────────────────────────────────────────────
        private class S
        {
            // Navigation
            public string   Screen       = ScrHome;

            // Give Items screen
            public string   Cat          = "All";
            public int      GivePage     = 0;
            public string   Item         = null;
            public string   ItemName     = null;
            public int      Stack        = 1;
            public ulong    GiveTarget   = 0;
            public string   Amt          = "100";
            public int      Custom       = 100;
            public DateTime LastGiveAt   = DateTime.MinValue;

            // Players screen
            public int      PlayerPage   = 0;
            public ulong    PlayerSel    = 0;

            // Redraw throttle
            public DateTime LastDrawAt   = DateTime.MinValue;
        }

        private readonly Dictionary<ulong, S> _s = new Dictionary<ulong, S>();
        private S Get(BasePlayer p) { if (!_s.ContainsKey(p.userID)) _s[p.userID] = new S(); return _s[p.userID]; }

        private double GiveCooldownLeft(S s) {
            double e = (DateTime.UtcNow - s.LastGiveAt).TotalSeconds;
            return e >= GiveCooldownSecs ? 0.0 : GiveCooldownSecs - e;
        }
        private bool AllowDraw(S s) {
            if ((DateTime.UtcNow - s.LastDrawAt).TotalMilliseconds < DrawThrottleMs) return false;
            s.LastDrawAt = DateTime.UtcNow; return true;
        }

        // ── Oxide hooks ───────────────────────────────────────────────────────
        void Init() => permission.RegisterPermission(PermUse, this);
        void Unload() { foreach (var p in BasePlayer.activePlayerList) CuiHelper.DestroyUi(p, UiMain); _s.Clear(); }
        void OnPlayerDisconnected(BasePlayer p, string r) { CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID); }
        void OnPlayerSleepEnded(BasePlayer p) { CuiHelper.DestroyUi(p, UiMain); }

        // ── Chat commands ─────────────────────────────────────────────────────
        [ChatCommand("ap")]
        void CmdAp(BasePlayer p, string c, string[] a) => Open(p);
        [ChatCommand("adminpanel")]
        void CmdPanel(BasePlayer p, string c, string[] a) => Open(p);

        void Open(BasePlayer p) {
            if (!permission.UserHasPermission(p.UserIDString, PermUse)) {
                SendReply(p, "<color=#F06A0F>MyRcon Admin Panel</color>: You don't have permission."); return;
            }
            var s = Get(p); s.Screen = ScrHome;
            Draw(p, force: true);
        }

        // ── Console commands ──────────────────────────────────────────────────
        [ConsoleCommand("mrap.close")]
        void CmdClose(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null) return;
            CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID);
        }

        [ConsoleCommand("mrap.nav")]
        void CmdNav(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); s.Screen = a.GetString(0);
            // Reset sub-state when navigating to a screen
            if (s.Screen == ScrGive)    { s.Item = null; s.GiveTarget = 0; }
            if (s.Screen == ScrPlayers) { s.PlayerSel = 0; s.PlayerPage = 0; }
            Draw(p, force: true);
        }

        // Give Items commands
        [ConsoleCommand("mrap.cat")]
        void CmdCat(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); s.Cat = a.GetString(0); s.GivePage = 0; s.Item = null; s.GiveTarget = 0; Draw(p);
        }
        [ConsoleCommand("mrap.page")]
        void CmdPage(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).GivePage = a.GetInt(0); Draw(p);
        }
        [ConsoleCommand("mrap.item")]
        void CmdItem(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var sn = a.GetString(0); var def = ItemManager.FindItemDefinition(sn); if (def == null) return;
            var s = Get(p); s.Item = sn; s.ItemName = def.displayName.translated; s.Stack = def.stackable; s.GiveTarget = 0; Draw(p);
        }
        [ConsoleCommand("mrap.target")]
        void CmdTarget(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var id = a.GetUInt64(0); s.GiveTarget = s.GiveTarget == id ? 0UL : id; Draw(p);
        }
        [ConsoleCommand("mrap.amt")]
        void CmdAmt(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).Amt = a.GetString(0); Draw(p);
        }
        [ConsoleCommand("mrap.custom")]
        void CmdCustom(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            if (int.TryParse(a.GetString(0), out int n) && n > 0) Get(p).Custom = Math.Min(n, 100000);
            Draw(p);
        }
        [ConsoleCommand("mrap.give")]
        void CmdGive(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null) return;
            var s = Get(p); if (string.IsNullOrEmpty(s.Item) || s.GiveTarget == 0) return;
            double left = GiveCooldownLeft(s);
            if (left > 0) { Draw(p, force: true); return; }
            var tgt = BasePlayer.FindByID(s.GiveTarget);
            if (tgt == null) { SendReply(p, "<color=#F06A0F>MyRcon</color>: Player disconnected."); return; }
            int amt = Resolve(s);
            var item = ItemManager.CreateByName(s.Item, amt);
            if (item == null) { SendReply(p, "<color=#F06A0F>MyRcon</color>: Unknown item."); return; }
            tgt.GiveItem(item);
            s.LastGiveAt = DateTime.UtcNow;
            Puts($"[AdminPanel] {p.displayName} gave {amt}x {s.Item} → {tgt.displayName}");
            SendReply(p, $"<color=#F06A0F>MyRcon</color>: Gave <color=#fff>{amt:N0}×</color> <color=#F06A0F>{s.ItemName}</color> to <color=#fff>{tgt.displayName}</color>.");
            s.GiveTarget = 0; Draw(p, force: true);
        }

        // Players screen commands
        [ConsoleCommand("mrap.ppage")]
        void CmdPPage(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).PlayerPage = a.GetInt(0); Draw(p);
        }
        [ConsoleCommand("mrap.psel")]
        void CmdPSel(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var id = a.GetUInt64(0); s.PlayerSel = s.PlayerSel == id ? 0UL : id; Draw(p);
        }
        [ConsoleCommand("mrap.paction")]
        void CmdPAction(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var action = a.GetString(0);
            if (s.PlayerSel == 0) return;
            var tgt = BasePlayer.FindByID(s.PlayerSel);
            switch (action) {
                case "teleport_to":
                    if (tgt != null) { p.Teleport(tgt.transform.position); SendReply(p, $"<color=#F06A0F>MyRcon</color>: Teleported to {tgt.displayName}."); }
                    break;
                case "teleport_here":
                    if (tgt != null) { tgt.Teleport(p.transform.position); SendReply(p, $"<color=#F06A0F>MyRcon</color>: Teleported {tgt.displayName} to you."); }
                    break;
                case "heal":
                    if (tgt != null) {
                        tgt.health = tgt.MaxHealth();
                        tgt.metabolism.hydration.value  = tgt.metabolism.hydration.max;
                        tgt.metabolism.calories.value   = tgt.metabolism.calories.max;
                        tgt.metabolism.bleeding.value   = 0f;
                        tgt.metabolism.radiation_poison.value = 0f;
                        tgt.metabolism.SendChangesToClient();
                        SendReply(p, $"<color=#F06A0F>MyRcon</color>: Healed {tgt.displayName}.");
                    }
                    break;
                case "strip":
                    if (tgt != null) {
                        tgt.inventory.Strip();
                        SendReply(p, $"<color=#F06A0F>MyRcon</color>: Stripped inventory of {tgt.displayName}.");
                        Puts($"[AdminPanel] {p.displayName} stripped inventory of {tgt.displayName}");
                    }
                    break;
                case "kick":
                    if (tgt != null) {
                        string name = tgt.displayName;
                        tgt.Kick("Kicked by admin");
                        s.PlayerSel = 0;
                        Puts($"[AdminPanel] {p.displayName} kicked {name}");
                        SendReply(p, $"<color=#F06A0F>MyRcon</color>: Kicked {name}.");
                    }
                    break;
                case "ban":
                    if (tgt != null) {
                        string name = tgt.displayName; ulong uid = tgt.userID;
                        ServerUsers.Set(uid, ServerUsers.UserGroup.Banned, name, $"Banned by {p.displayName}");
                        ServerUsers.Save();
                        tgt.Kick("Banned by admin");
                        s.PlayerSel = 0;
                        Puts($"[AdminPanel] {p.displayName} banned {name} ({uid})");
                        SendReply(p, $"<color=#F06A0F>MyRcon</color>: Banned {name}.");
                    }
                    break;
            }
            Draw(p, force: true);
        }

        // Server screen commands
        [ConsoleCommand("mrap.svcmd")]
        void CmdSvCmd(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var cmd = a.GetString(0);
            switch (cmd) {
                case "save":
                    SaveRestore.Save(true);
                    SendReply(p, "<color=#F06A0F>MyRcon</color>: Server saved.");
                    break;
                case "day":
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "env.time", "9");
                    SendReply(p, "<color=#F06A0F>MyRcon</color>: Time set to day.");
                    break;
                case "night":
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "env.time", "21");
                    SendReply(p, "<color=#F06A0F>MyRcon</color>: Time set to night.");
                    break;
                case "weather_clear":
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.rain", "0");
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.fog",  "0");
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.clouds", "0");
                    SendReply(p, "<color=#F06A0F>MyRcon</color>: Weather cleared.");
                    break;
                case "supply":
                    var drop = GameManager.server.CreateEntity("assets/prefabs/misc/supply drop/supply_drop.prefab",
                        p.transform.position + new Vector3(0, 200, 0)) as SupplyDrop;
                    if (drop != null) { drop.Spawn(); SendReply(p, "<color=#F06A0F>MyRcon</color>: Supply drop spawned above you."); }
                    break;
                case "healall":
                    foreach (var pl in BasePlayer.activePlayerList) {
                        pl.health = pl.MaxHealth();
                        pl.metabolism.hydration.value = pl.metabolism.hydration.max;
                        pl.metabolism.calories.value  = pl.metabolism.calories.max;
                        pl.metabolism.bleeding.value  = 0f;
                        pl.metabolism.radiation_poison.value = 0f;
                        pl.metabolism.SendChangesToClient();
                    }
                    SendReply(p, $"<color=#F06A0F>MyRcon</color>: Healed all {BasePlayer.activePlayerList.Count} players.");
                    break;
            }
            Draw(p, force: true);
        }

        // ── Master draw ───────────────────────────────────────────────────────

        void Draw(BasePlayer player, bool force = false) {
            var s = Get(player);
            if (!force && !AllowDraw(s)) return;

            CuiHelper.DestroyUi(player, UiMain);
            var ui = new CuiElementContainer();

            ui.Add(new CuiPanel {
                Image           = { Color = CBg },
                RectTransform   = { AnchorMin = "0.15 0.08", AnchorMax = "0.85 0.93" },
                CursorEnabled   = true,
                KeyboardEnabled = false
            }, "Overlay", UiMain);

            DrawHeader(ui, s);

            // Body panel sits below header
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.942" }
            }, UiMain, UiBody);

            switch (s.Screen) {
                case ScrHome:    DrawHome(ui, s);              break;
                case ScrGive:    DrawGiveScreen(ui, s, player); break;
                case ScrPlayers: DrawPlayersScreen(ui, s, player); break;
                case ScrServer:  DrawServerScreen(ui, s);      break;
            }

            CuiHelper.AddUi(player, ui);
        }

        // ── Header (all screens) ──────────────────────────────────────────────

        void DrawHeader(CuiElementContainer ui, S s) {
            ui.Add(new CuiPanel {
                Image         = { Color = CPanel },
                RectTransform = { AnchorMin = "0 0.945", AnchorMax = "1 1" }
            }, UiMain, "MRAP_H");

            ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0.91", AnchorMax = "1 1" } }, "MRAP_H");

            // Back button (shown on all non-home screens)
            if (s.Screen != ScrHome) {
                ui.Add(new CuiButton {
                    Button        = { Command = "mrap.nav home", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0.012 0.1", AnchorMax = "0.075 0.88" },
                    Text          = { Text = "< Back", FontSize = 10, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }
                }, "MRAP_H");
                ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.074 0.2", AnchorMax = "0.077 0.8" } }, "MRAP_H");
            }

            float logoX = s.Screen != ScrHome ? 0.082f : 0.014f;

            ui.Add(new CuiLabel {
                Text          = { Text = "MyRcon", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = COrange, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = $"{logoX:F3} 0.05", AnchorMax = $"{logoX+0.09f:F3} 0.88" }
            }, "MRAP_H");

            string title;
            if      (s.Screen == ScrGive)    title = "Give Items";
            else if (s.Screen == ScrPlayers) title = "Players";
            else if (s.Screen == ScrServer)  title = "Server";
            else                             title = "Admin Panel";

            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = $"{logoX+0.088f:F3} 0.2", AnchorMax = $"{logoX+0.091f:F3} 0.8" } }, "MRAP_H");
            ui.Add(new CuiLabel {
                Text          = { Text = title, FontSize = 12, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = $"{logoX+0.097f:F3} 0.05", AnchorMax = "0.88 0.88" }
            }, "MRAP_H");

            ui.Add(new CuiButton {
                Button        = { Command = "mrap.close", Color = "0.65 0.15 0.1 0.7" },
                RectTransform = { AnchorMin = "0.93 0.1", AnchorMax = "0.997 0.88" },
                Text          = { Text = "X", FontSize = 16, Align = TextAnchor.MiddleCenter, Color = "1 0.75 0.7 1", Font = "robotocondensed-bold.ttf" }
            }, "MRAP_H");
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  HOME SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private struct Tile { public string Screen; public string Title; public string Desc; public string[] Items; public string Accent; public string AccentDim; }

        private static readonly Tile[] Tiles = {
            new Tile { Screen = ScrGive,    Title = "Give Items",    Desc = "Give any item to any online player", Items = new[]{"rifle.ak","explosive.timed","metal.facemask","scrap"},              Accent = COrange, AccentDim = COrangeDim },
            new Tile { Screen = ScrPlayers, Title = "Players",       Desc = "Teleport, heal, kick, ban players",  Items = new[]{"coffeecan.helmet","hoodie","pants","shoes.boots"},                  Accent = CBlue,   AccentDim = CBlueDim   },
            new Tile { Screen = ScrServer,  Title = "Server",        Desc = "Quick server commands & tools",      Items = new[]{"hammer","furnace","workbench1","box.wooden.large"},                  Accent = CGreen,  AccentDim = CGreenDim  },
            new Tile { Screen = "",         Title = "Coming Soon",   Desc = "More tools being added",             Items = new string[0],                                                             Accent = CDim,    AccentDim = "0 0 0 0"  },
        };

        void DrawHome(CuiElementContainer ui, S s) {
            // Welcome label
            ui.Add(new CuiLabel {
                Text          = { Text = "Select a tool to get started", FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.04 0.88", AnchorMax = "0.96 0.97" }
            }, UiBody);

            // 2×2 tile grid
            const float padX = 0.03f;
            const float padY = 0.07f;
            const float gapX = 0.025f;
            const float gapY = 0.025f;
            const int   cols = 2;
            const int   rows = 2;
            float tileW = (1f - 2 * padX - (cols - 1) * gapX) / cols;
            float tileH = (0.87f - padY - (rows - 1) * gapY) / rows;

            for (int i = 0; i < Tiles.Length; i++) {
                var t    = Tiles[i];
                int col  = i % cols;
                int row  = i / cols;
                float x0 = padX + col * (tileW + gapX);
                float y1 = 0.87f - row * (tileH + gapY);
                float y0 = y1 - tileH;
                string tn = $"MRAP_T{i}";

                // Tile bg
                ui.Add(new CuiPanel {
                    Image         = { Color = CCell },
                    RectTransform = { AnchorMin = $"{x0:F3} {y0:F3}", AnchorMax = $"{x0+tileW:F3} {y1:F3}" }
                }, UiBody, tn);

                // Top accent strip
                ui.Add(new CuiPanel {
                    Image         = { Color = t.Accent },
                    RectTransform = { AnchorMin = "0 0.955", AnchorMax = "1 1" }
                }, tn);

                // Item image strip (visual decoration)
                if (t.Items.Length > 0) {
                    float imgW = 1f / t.Items.Length;
                    for (int j = 0; j < t.Items.Length; j++) {
                        var def = ItemManager.FindItemDefinition(t.Items[j]);
                        if (def == null) continue;
                        float ix = j * imgW;
                        string imgN = $"{tn}_img{j}";
                        ui.Add(new CuiPanel {
                            Image         = { Color = t.AccentDim },
                            RectTransform = { AnchorMin = $"{ix:F3} 0.58", AnchorMax = $"{ix+imgW:F3} 0.95" }
                        }, tn, imgN);
                        ui.Add(new CuiElement {
                            Parent     = imgN,
                            Components = {
                                new CuiImageComponent { ItemId = def.itemid, SkinId = 0 },
                                new CuiRectTransformComponent { AnchorMin = "0.1 0.08", AnchorMax = "0.9 0.92" }
                            }
                        });
                    }
                }

                // Title
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Title, FontSize = 14, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                    RectTransform = { AnchorMin = "0.06 0.33", AnchorMax = "0.94 0.58" }
                }, tn);

                // Description
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Desc, FontSize = 10, Align = TextAnchor.UpperLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = "0.06 0.06", AnchorMax = "0.94 0.34" }
                }, tn);

                // Click — only for real screens
                if (!string.IsNullOrEmpty(t.Screen)) {
                    ui.Add(new CuiButton {
                        Button        = { Command = $"mrap.nav {t.Screen}", Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                        Text          = { Text = "" }
                    }, tn);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  GIVE ITEMS SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        void DrawGiveScreen(CuiElementContainer ui, S s, BasePlayer invoker) {
            float xRight = s.Item != null ? 0.655f : 1f;

            // Category tabs
            string tabsN = "MRAP_Tabs";
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = $"0 0.895", AnchorMax = $"{xRight:F3} 0.942" }
            }, UiBody, tabsN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.06" } }, tabsN);

            float tabW = 1f / AllCats.Count;
            for (int i = 0; i < AllCats.Count; i++) {
                string cat = AllCats[i]; bool active = s.Cat == cat;
                float xMin = i * tabW; float xMax = xMin + tabW;
                if (active) {
                    ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = $"{xMin:F3} 0.08", AnchorMax = $"{xMax:F3} 1" } }, tabsN);
                    ui.Add(new CuiPanel { Image = { Color = COrange },    RectTransform = { AnchorMin = $"{xMin:F3} 0",    AnchorMax = $"{xMax:F3} 0.12" } }, tabsN);
                }
                ui.Add(new CuiButton {
                    Button        = { Command = $"mrap.cat {cat}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = $"{xMin:F3} 0.08", AnchorMax = $"{xMax:F3} 1" },
                    Text          = { Text = cat, FontSize = 9, Align = TextAnchor.MiddleCenter, Color = active ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" }
                }, tabsN);
            }

            // Item grid
            string gridN = "MRAP_Grid";
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0.05", AnchorMax = $"{xRight:F3} 0.893" }
            }, UiBody, gridN);

            var items = ItemsFor(s.Cat);
            int pages = Math.Max(1, (int)Math.Ceiling(items.Count / (float)PerPage));
            s.GivePage = Mathf.Clamp(s.GivePage, 0, pages - 1);
            var page = items.Skip(s.GivePage * PerPage).Take(PerPage).ToList();

            const float gX = 0.008f; const float gY = 0.01f; const float bH = 0.09f;
            float cW = (1f - gX * (GridCols + 1)) / GridCols;
            float cH = (1f - bH - gY * (GridRows + 1)) / GridRows;

            for (int i = 0; i < page.Count; i++) {
                string sn = page[i]; var def = ItemManager.FindItemDefinition(sn); if (def == null) continue;
                int col = i % GridCols; int row = i / GridCols;
                float xMin = gX + col * (cW + gX);
                float yMin = bH + gY + (GridRows - 1 - row) * (cH + gY);
                bool sel = s.Item == sn; string cn = $"MRAP_I{i}";

                ui.Add(new CuiPanel { Image = { Color = sel ? CCellSel : CCell }, RectTransform = { AnchorMin = $"{xMin:F3} {yMin:F3}", AnchorMax = $"{xMin+cW:F3} {yMin+cH:F3}" } }, gridN, cn);
                if (sel) ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.025 1" } }, cn);
                ui.Add(new CuiElement { Parent = cn, Components = {
                    new CuiImageComponent { ItemId = def.itemid, SkinId = 0 },
                    new CuiRectTransformComponent { AnchorMin = "0.1 0.28", AnchorMax = "0.9 0.94" }
                }});
                ui.Add(new CuiLabel { Text = { Text = def.displayName.translated, FontSize = 7, Align = TextAnchor.MiddleCenter, Color = sel ? "1 0.82 0.62 1" : CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.02 0.01", AnchorMax = "0.98 0.28" } }, cn);
                ui.Add(new CuiButton { Button = { Command = $"mrap.item {sn}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, cn);
            }

            ui.Add(new CuiLabel { Text = { Text = $"{s.Cat}  ·  {items.Count} items  ·  {s.GivePage + 1}/{pages}", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.01 0.005", AnchorMax = "0.55 0.075" } }, gridN);
            if (s.GivePage > 0) ui.Add(new CuiButton { Button = { Command = $"mrap.page {s.GivePage - 1}", Color = CCell }, RectTransform = { AnchorMin = "0.57 0.008", AnchorMax = "0.77 0.078" }, Text = { Text = "< Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);
            if (s.GivePage < pages - 1) ui.Add(new CuiButton { Button = { Command = $"mrap.page {s.GivePage + 1}", Color = CCell }, RectTransform = { AnchorMin = "0.79 0.008", AnchorMax = "0.998 0.078" }, Text = { Text = "Next >", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);

            // Give panel
            if (s.Item != null) DrawGivePanel(ui, s, invoker, GiveCooldownLeft(s));
        }

        void DrawGivePanel(CuiElementContainer ui, S s, BasePlayer invoker, double cd) {
            string gp = "MRAP_GP";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.66 0", AnchorMax = "1 0.942" } }, UiBody, gp);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.005 1" } }, gp);

            // Item header
            ui.Add(new CuiPanel { Image = { Color = "0.05 0.06 0.08 1" }, RectTransform = { AnchorMin = "0 0.895", AnchorMax = "1 1" } }, gp, "MRAP_GH");
            var hdef = ItemManager.FindItemDefinition(s.Item);
            if (hdef != null) ui.Add(new CuiElement { Parent = "MRAP_GH", Components = { new CuiImageComponent { ItemId = hdef.itemid, SkinId = 0 }, new CuiRectTransformComponent { AnchorMin = "0.04 0.08", AnchorMax = "0.22 0.92" } } });
            ui.Add(new CuiLabel { Text = { Text = s.ItemName ?? s.Item, FontSize = 11, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.25 0.5", AnchorMax = "0.98 0.95" } }, "MRAP_GH");
            ui.Add(new CuiLabel { Text = { Text = s.Item, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.25 0.05", AnchorMax = "0.98 0.52" } }, "MRAP_GH");

            ui.Add(new CuiLabel { Text = { Text = "GIVE TO", FontSize = 7, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.848", AnchorMax = "0.95 0.89" } }, gp);

            var players = BasePlayer.activePlayerList.OrderBy(p => p.userID != invoker.userID).ThenBy(p => p.displayName).ToList();
            const float rH = 0.058f; const float rGap = 0.005f; float rTop = 0.845f; const int maxR = 8;
            for (int i = 0; i < Math.Min(players.Count, maxR); i++) {
                var pl = players[i]; bool inv = pl.userID == invoker.userID; bool sel = s.GiveTarget == pl.userID;
                float yMx = rTop - i * (rH + rGap); float yMn = yMx - rH; string rn = $"MRAP_PR{i}";
                ui.Add(new CuiPanel { Image = { Color = sel ? "0.15 0.08 0.02 1" : "0.075 0.09 0.11 1" }, RectTransform = { AnchorMin = $"0.04 {yMn:F3}", AnchorMax = $"0.96 {yMx:F3}" } }, gp, rn);
                ui.Add(new CuiPanel { Image = { Color = sel ? COrange : CDivider }, RectTransform = { AnchorMin = "0 0.15", AnchorMax = "0.015 0.85" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = pl.displayName, FontSize = 10, Align = TextAnchor.MiddleLeft, Color = sel ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.06 0", AnchorMax = inv ? "0.72 1" : "0.97 1" } }, rn);
                if (inv) {
                    ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0.74 0.18", AnchorMax = "0.98 0.82" } }, rn);
                    ui.Add(new CuiLabel { Text = { Text = "YOU", FontSize = 7, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.74 0.18", AnchorMax = "0.98 0.82" } }, rn);
                }
                ui.Add(new CuiButton { Button = { Command = $"mrap.target {pl.userID}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }
            if (players.Count > maxR) ui.Add(new CuiLabel { Text = { Text = $"+{players.Count - maxR} more online", FontSize = 8, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0.04 0.375", AnchorMax = "0.96 0.415" } }, gp);

            ui.Add(new CuiLabel { Text = { Text = "AMOUNT", FontSize = 7, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.337", AnchorMax = "0.95 0.372" } }, gp);
            var modes = new (string m, string l)[] { ("100","100"), ("1000","1,000"), ("stack",$"Stack ({s.Stack})"), ("custom","Custom") };
            const float bH2 = 0.062f; const float bGap = 0.01f; float bTop = 0.334f;
            for (int i = 0; i < 4; i++) {
                var (m, l) = modes[i]; bool on = s.Amt == m;
                int col = i % 2; int row = i / 2;
                float xMn = 0.04f + col * (0.475f + bGap); float yMx = bTop - row * (bH2 + bGap); float yMn2 = yMx - bH2;
                ui.Add(new CuiButton { Button = { Command = $"mrap.amt {m}", Color = on ? COrangeDim : "0.08 0.1 0.13 1" }, RectTransform = { AnchorMin = $"{xMn:F3} {yMn2:F3}", AnchorMax = $"{xMn+0.475f:F3} {yMx:F3}" }, Text = { Text = l, FontSize = 9, Align = TextAnchor.MiddleCenter, Color = on ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" } }, gp);
            }

            float baseY = bTop - 2 * (bH2 + bGap);
            if (s.Amt == "custom") {
                ui.Add(new CuiPanel { Image = { Color = "0.08 0.1 0.13 1" }, RectTransform = { AnchorMin = $"0.04 {baseY - 0.072f:F3}", AnchorMax = $"0.96 {baseY:F3}" } }, gp, "MRAP_In");
                ui.Add(new CuiElement { Name = "MRAP_InF", Parent = "MRAP_In", Components = {
                    new CuiInputFieldComponent { Text = s.Custom.ToString(), FontSize = 13, Align = TextAnchor.MiddleCenter, Command = "mrap.custom", Color = CText, CharsLimit = 6 },
                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                }});
                baseY -= 0.08f;
            }

            int res = Resolve(s);
            ui.Add(new CuiLabel { Text = { Text = $"→  {res:N0} ×  {(s.ItemName ?? s.Item)}", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = $"0.04 {baseY - 0.04f:F3}", AnchorMax = $"0.96 {baseY:F3}" } }, gp);

            bool can = s.GiveTarget != 0; bool onCd = cd > 0;
            string btnCmd = (can && !onCd) ? "mrap.give" : "";
            string btnColor = onCd ? CCooldown : (can ? COrange : CBtnOff);
            string btnText = onCd ? $"Wait  {cd:F1}s…" : can ? $"Give  {res:N0} ×" : "Select a player";
            ui.Add(new CuiButton { Button = { Command = btnCmd, Color = btnColor }, RectTransform = { AnchorMin = "0.04 0.022", AnchorMax = "0.96 0.098" }, Text = { Text = btnText, FontSize = 12, Align = TextAnchor.MiddleCenter, Color = (can && !onCd) ? "1 1 1 1" : CDim, Font = "robotocondensed-bold.ttf" } }, gp);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  PLAYERS SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private const int PlayersPerPage = 10;

        void DrawPlayersScreen(CuiElementContainer ui, S s, BasePlayer invoker) {
            var allPlayers = BasePlayer.activePlayerList.OrderBy(p => p.displayName).ToList();
            int pages = Math.Max(1, (int)Math.Ceiling(allPlayers.Count / (float)PlayersPerPage));
            s.PlayerPage = Mathf.Clamp(s.PlayerPage, 0, pages - 1);
            var pagePlayers = allPlayers.Skip(s.PlayerPage * PlayersPerPage).Take(PlayersPerPage).ToList();

            // Left: player list (58%)
            string listN = "MRAP_PL";
            ui.Add(new CuiPanel { Image = { Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0.05", AnchorMax = "0.57 0.97" } }, UiBody, listN);

            ui.Add(new CuiLabel { Text = { Text = $"Online Players  ·  {allPlayers.Count}", FontSize = 10, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.02 0.94", AnchorMax = "0.98 1" } }, listN);

            const float rH = 0.082f; const float rG = 0.008f;
            for (int i = 0; i < pagePlayers.Count; i++) {
                var pl = pagePlayers[i];
                bool isSelf = pl.userID == invoker.userID;
                bool sel    = s.PlayerSel == pl.userID;
                float y1 = 0.93f - i * (rH + rG); float y0 = y1 - rH;
                string rn = $"MRAP_PLR{i}";

                ui.Add(new CuiPanel { Image = { Color = sel ? CBlueDim : CCell }, RectTransform = { AnchorMin = $"0 {y0:F3}", AnchorMax = $"1 {y1:F3}" } }, listN, rn);
                // Left accent
                ui.Add(new CuiPanel { Image = { Color = sel ? CBlue : CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.012 1" } }, rn);
                // Online dot
                ui.Add(new CuiPanel { Image = { Color = "0.22 0.7 0.3 1" }, RectTransform = { AnchorMin = "0.025 0.38", AnchorMax = "0.045 0.62" } }, rn);
                // Name
                ui.Add(new CuiLabel { Text = { Text = pl.displayName + (isSelf ? "  (you)" : ""), FontSize = 11, Align = TextAnchor.MiddleLeft, Color = sel ? "0.75 0.88 1 1" : CText, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.055 0.36", AnchorMax = "0.75 1" } }, rn);
                // Steam ID
                ui.Add(new CuiLabel { Text = { Text = pl.UserIDString, FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.055 0", AnchorMax = "0.75 0.4" } }, rn);
                // Ping
                ui.Add(new CuiLabel { Text = { Text = Network.Net.sv.GetAveragePing(pl.Connection) + "ms", FontSize = 9, Align = TextAnchor.MiddleRight, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.75 0", AnchorMax = "0.97 1" } }, rn);

                if (!isSelf) ui.Add(new CuiButton { Button = { Command = $"mrap.psel {pl.userID}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }

            if (allPlayers.Count == 0)
                ui.Add(new CuiLabel { Text = { Text = "No other players online", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0 0.4", AnchorMax = "1 0.6" } }, listN);

            // Pagination
            ui.Add(new CuiLabel { Text = { Text = $"Page {s.PlayerPage + 1} / {pages}", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim }, RectTransform = { AnchorMin = "0.02 0", AnchorMax = "0.5 0.05" } }, listN);
            if (s.PlayerPage > 0)       ui.Add(new CuiButton { Button = { Command = $"mrap.ppage {s.PlayerPage - 1}", Color = CCell }, RectTransform = { AnchorMin = "0.5 0", AnchorMax = "0.73 0.048" }, Text = { Text = "<", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);
            if (s.PlayerPage < pages-1) ui.Add(new CuiButton { Button = { Command = $"mrap.ppage {s.PlayerPage + 1}", Color = CCell }, RectTransform = { AnchorMin = "0.75 0", AnchorMax = "0.98 0.048" }, Text = { Text = ">", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);

            // Right: action panel (40%)
            string actN = "MRAP_PA";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.59 0", AnchorMax = "1 0.97" } }, UiBody, actN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.005 1" } }, actN);

            var sel2 = s.PlayerSel != 0 ? BasePlayer.FindByID(s.PlayerSel) : null;

            if (sel2 == null) {
                ui.Add(new CuiLabel { Text = { Text = "Select a player\nto see actions", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.35", AnchorMax = "0.95 0.65" } }, actN);
            } else {
                // Selected player header
                ui.Add(new CuiPanel { Image = { Color = "0.05 0.06 0.08 1" }, RectTransform = { AnchorMin = "0 0.9", AnchorMax = "1 1" } }, actN, "MRAP_PAH");
                ui.Add(new CuiPanel { Image = { Color = CBlue }, RectTransform = { AnchorMin = "0 0.93", AnchorMax = "1 1" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.displayName, FontSize = 12, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.06 0.42", AnchorMax = "0.94 0.92" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.UserIDString, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.06 0.05", AnchorMax = "0.94 0.45" } }, "MRAP_PAH");

                // Action buttons
                string[] aCmds   = { "teleport_to",   "teleport_here",       "heal",              "strip",           "kick",                "ban"           };
                string[] aLabels = { "Teleport To",   "Teleport Here",       "Heal",              "Strip",           "Kick",                "Ban"           };
                string[] aDescs  = { "Go to player",  "Bring player to you", "Full health & food","Clear inventory", "Remove from server",  "Permanent ban" };
                string[] aClrs   = { CBlue,           CBlue,                 CGreen,              COrange,           CRed,                  CRed            };
                string[] aClrDs  = { CBlueDim,        CBlueDim,              CGreenDim,           COrangeDim,        CRedDim,               CRedDim         };

                const float abH = 0.105f; const float abG = 0.012f;
                float abTop = 0.875f;
                for (int i = 0; i < aCmds.Length; i++) {
                    float ay1 = abTop - i * (abH + abG); float ay0 = ay1 - abH;
                    string an = $"MRAP_ACT{i}";
                    ui.Add(new CuiPanel { Image = { Color = aClrDs[i] }, RectTransform = { AnchorMin = $"0.05 {ay0:F3}", AnchorMax = $"0.95 {ay1:F3}" } }, actN, an);
                    ui.Add(new CuiPanel { Image = { Color = aClrs[i] },  RectTransform = { AnchorMin = "0 0", AnchorMax = "0.018 1" } }, an);
                    ui.Add(new CuiLabel { Text = { Text = aLabels[i], FontSize = 11, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.06 0.42", AnchorMax = "0.94 0.97" } }, an);
                    ui.Add(new CuiLabel { Text = { Text = aDescs[i], FontSize = 9, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.06 0.03", AnchorMax = "0.94 0.5" } }, an);
                    ui.Add(new CuiButton { Button = { Command = $"mrap.paction {aCmds[i]}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, an);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  SERVER SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        void DrawServerScreen(CuiElementContainer ui, S s) {
            string[] svCmds   = { "save",             "day",              "night",              "weather_clear",          "supply",                    "healall"               };
            string[] svLabels = { "Save Server",       "Set Day",          "Set Night",          "Clear Weather",          "Supply Drop",               "Heal All"              };
            string[] svDescs  = { "Write data to disk","Jump to 9:00 AM",  "Jump to 9:00 PM",   "No rain, fog or clouds", "Drop above your position",  "Full health for all"   };
            string[] svClrs   = { CGreen,              COrange,            CBlue,                CBlue,                    COrange,                     CGreen                  };
            string[] svClrDs  = { CGreenDim,           COrangeDim,         CBlueDim,             CBlueDim,                 COrangeDim,                  CGreenDim               };
            string[] svIcons  = { "box.wooden.large",  "torch",            "flashlight.held",    "water.bottle",           "supply.signal",             "syringe.medical"       };

            ui.Add(new CuiLabel { Text = { Text = "Quick Commands", FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.03 0.91", AnchorMax = "0.97 0.97" } }, UiBody);

            const int svCols = 2;
            const float padX = 0.03f;
            const float gapX = 0.025f; const float gapY = 0.025f;
            float cardW = (1f - 2 * padX - (svCols - 1) * gapX) / svCols;
            float cardH = 0.12f;
            float startY = 0.895f;

            for (int i = 0; i < svCmds.Length; i++) {
                int col = i % svCols; int row = i / svCols;
                float x0 = padX + col * (cardW + gapX);
                float y1 = startY - row * (cardH + gapY);
                float y0 = y1 - cardH;
                string cn = $"MRAP_SV{i}";

                ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = $"{x0:F3} {y0:F3}", AnchorMax = $"{x0+cardW:F3} {y1:F3}" } }, UiBody, cn);
                ui.Add(new CuiPanel { Image = { Color = svClrs[i] },  RectTransform = { AnchorMin = "0 0", AnchorMax = "0.012 1" } }, cn);
                ui.Add(new CuiPanel { Image = { Color = svClrDs[i] }, RectTransform = { AnchorMin = "0.88 0.08", AnchorMax = "0.99 0.92" } }, cn, $"{cn}_icon");
                var svDef = ItemManager.FindItemDefinition(svIcons[i]);
                if (svDef != null) ui.Add(new CuiElement { Parent = $"{cn}_icon", Components = { new CuiImageComponent { ItemId = svDef.itemid, SkinId = 0 }, new CuiRectTransformComponent { AnchorMin = "0.08 0.08", AnchorMax = "0.92 0.92" } } });
                ui.Add(new CuiLabel { Text = { Text = svLabels[i], FontSize = 12, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.42", AnchorMax = "0.85 0.97" } }, cn);
                ui.Add(new CuiLabel { Text = { Text = svDescs[i], FontSize = 9, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.03", AnchorMax = "0.85 0.46" } }, cn);
                ui.Add(new CuiButton { Button = { Command = $"mrap.svcmd {svCmds[i]}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, cn);
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        static List<string> ItemsFor(string cat) {
            if (cat == "All") return Categories.Values.SelectMany(x => x).ToList();
            return Categories.TryGetValue(cat, out var l) ? l : new List<string>();
        }
        static int Resolve(S s) {
            switch (s.Amt) {
                case "100": return 100; case "1000": return 1000;
                case "stack": return Math.Max(1, s.Stack);
                case "custom": return Math.Max(1, s.Custom);
                default: return 100;
            }
        }
    }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Registry
// ─────────────────────────────────────────────────────────────────────────────

export const EXCLUSIVE_PLUGINS: ExclusivePlugin[] = [
  {
    id: "admin-panel",
    name: "Admin Panel",
    version: "1.3.2",
    description: "In-game admin dashboard with a navigation home screen. Give Items, Players (teleport/heal/kick/ban), and Server quick commands.",
    longDescription: "Opens a compact CUI dashboard in-game (/ap or /adminpanel). Home screen navigation tiles: Give Items (browse 11 categories, give to any player), Players (teleport to/from, heal, strip, kick, ban), Server (save, set day/night, clear weather, supply drop, heal all). Built-in spam protection with per-player cooldowns. Requires the myrconadminpanel.use permission.",
    tags: ["Admin", "Inventory", "QoL"],
    filename: "MyRconAdminPanel.cs",
    defaultPath: "oxide/plugins/MyRconAdminPanel.cs",
    permissions: ["myrconadminpanel.use"],
    previewItems: [
      "rifle.ak", "rifle.bolt", "lmg.m249", "rocket.launcher",
      "explosive.timed", "metal.facemask", "metal.plate.torso", "jackhammer",
      "metal.refined", "scrap", "ammo.rifle", "grenade.f1",
    ],
    content: ADMIN_PANEL_CS,
  },
];

export function getPlugin(id: string): ExclusivePlugin | undefined {
  return EXCLUSIVE_PLUGINS.find((p) => p.id === id);
}
