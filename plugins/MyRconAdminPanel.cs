using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.5.0")]
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
        private const string CBg        = "0.04 0.05 0.07 0.98";
        private const string CPanel     = "0.065 0.08 0.10 1";
        private const string CHeader    = "0.04 0.055 0.075 1";
        private const string CCell      = "0.085 0.105 0.13 1";
        private const string CCellSel   = "0.16 0.08 0.02 1";
        private const string CDivider   = "1 1 1 0.05";
        private const string COrange    = "0.94 0.42 0.06 1";
        private const string COrangeDim = "0.94 0.42 0.06 0.15";
        private const string CBlue      = "0.18 0.45 0.82 1";
        private const string CBlueDim   = "0.18 0.45 0.82 0.15";
        private const string CGreen     = "0.22 0.65 0.32 1";
        private const string CGreenDim  = "0.22 0.65 0.32 0.15";
        private const string CRed       = "0.75 0.18 0.12 1";
        private const string CRedDim    = "0.75 0.18 0.12 0.18";
        private const string CText      = "0.90 0.92 0.95 1";
        private const string CMuted     = "0.48 0.53 0.60 1";
        private const string CDim       = "0.28 0.32 0.38 1";
        private const string CBtnOff    = "0.09 0.11 0.15 1";
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

            // Server screen
            public float    SvTimeHour   = 12f;
            public float    SvRain       = 0f;
            public float    SvFog        = 0f;
            public float    SvClouds     = 0f;
            public float    SvWind       = 0f;

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

        [ConsoleCommand("mrap.svtime")]
        void CmdSvTime(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p);
            s.SvTimeHour = ((a.GetFloat(0) % 24f) + 24f) % 24f;
            ConsoleSystem.Run(ConsoleSystem.Option.Server, "env.time", s.SvTimeHour.ToString("F1"));
            Draw(p, force: true);
        }

        [ConsoleCommand("mrap.svwp")]
        void CmdSvWeatherPreset(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p);
            switch (a.GetString(0)) {
                case "clear":    ApplyWeather(s, 0f,   0f,    0f,   0f);   break;
                case "overcast": ApplyWeather(s, 0f,   0.05f, 0.8f, 0.2f); break;
                case "rain":     ApplyWeather(s, 0.7f, 0.1f,  0.9f, 0.3f); break;
                case "fog":      ApplyWeather(s, 0f,   0.85f, 0.5f, 0f);   break;
                case "storm":    ApplyWeather(s, 1f,   0.3f,  1f,   0.8f); break;
            }
            Draw(p, force: true);
        }

        [ConsoleCommand("mrap.svwv")]
        void CmdSvWeatherValue(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs(2)) return;
            var s = Get(p);
            float val    = Mathf.Clamp01(a.GetFloat(1));
            string key   = a.GetString(0);
            string convar = null;
            switch (key) {
                case "rain":   s.SvRain   = val; convar = "weather.rain";   break;
                case "fog":    s.SvFog    = val; convar = "weather.fog";    break;
                case "clouds": s.SvClouds = val; convar = "weather.clouds"; break;
                case "wind":   s.SvWind   = val; convar = "weather.wind";   break;
            }
            if (convar != null)
                ConsoleSystem.Run(ConsoleSystem.Option.Server, convar, val.ToString("F2"));
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
            // Deep header bar
            ui.Add(new CuiPanel {
                Image         = { Color = CHeader },
                RectTransform = { AnchorMin = "0 0.945", AnchorMax = "1 1" }
            }, UiMain, "MRAP_H");

            // Left orange brand stripe (thin vertical line)
            ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.005 1" } }, "MRAP_H");
            // Bottom separator line
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.005 0", AnchorMax = "1 0.045" } }, "MRAP_H");

            float xCursor = 0.013f;

            // Back button styled as a chip
            if (s.Screen != ScrHome) {
                ui.Add(new CuiButton {
                    Button        = { Command = "mrap.nav home", Color = "0.09 0.11 0.15 1" },
                    RectTransform = { AnchorMin = $"{xCursor:F3} 0.16", AnchorMax = $"{xCursor+0.078f:F3} 0.84" },
                    Text          = { Text = "< Back", FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-regular.ttf" }
                }, "MRAP_H");
                xCursor += 0.086f;
                ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = $"{xCursor:F3} 0.22", AnchorMax = $"{xCursor+0.002f:F3} 0.78" } }, "MRAP_H");
                xCursor += 0.01f;
            }

            // "MR" logo pill
            ui.Add(new CuiPanel {
                Image         = { Color = COrangeDim },
                RectTransform = { AnchorMin = $"{xCursor:F3} 0.18", AnchorMax = $"{xCursor+0.065f:F3} 0.82" }
            }, "MRAP_H", "MRAP_Logo");
            ui.Add(new CuiLabel {
                Text          = { Text = "MR", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
            }, "MRAP_Logo");
            xCursor += 0.073f;

            // App name
            ui.Add(new CuiLabel {
                Text          = { Text = "MyRcon", FontSize = 12, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = $"{xCursor:F3} 0.1", AnchorMax = $"{xCursor+0.085f:F3} 0.9" }
            }, "MRAP_H");
            xCursor += 0.091f;

            // Breadcrumb: separator + screen title
            string title = "";
            if      (s.Screen == ScrGive)    title = "Give Items";
            else if (s.Screen == ScrPlayers) title = "Players";
            else if (s.Screen == ScrServer)  title = "Server";

            if (title.Length > 0) {
                ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = $"{xCursor:F3} 0.22", AnchorMax = $"{xCursor+0.002f:F3} 0.78" } }, "MRAP_H");
                xCursor += 0.01f;
                ui.Add(new CuiLabel {
                    Text          = { Text = title, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = $"{xCursor:F3} 0.1", AnchorMax = "0.88 0.9" }
                }, "MRAP_H");
            }

            // Close button
            ui.Add(new CuiButton {
                Button        = { Command = "mrap.close", Color = "0.42 0.07 0.05 0.9" },
                RectTransform = { AnchorMin = "0.938 0.14", AnchorMax = "0.997 0.86" },
                Text          = { Text = "X", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = "1 0.55 0.5 1", Font = "robotocondensed-bold.ttf" }
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
            // Subheader: subtitle left, player count right
            int onlineCount = BasePlayer.activePlayerList.Count;
            ui.Add(new CuiLabel {
                Text          = { Text = "Admin Panel", FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.035 0.895", AnchorMax = "0.6 0.96" }
            }, UiBody);
            ui.Add(new CuiLabel {
                Text          = { Text = $"{onlineCount} online", FontSize = 10, Align = TextAnchor.MiddleRight, Color = onlineCount > 0 ? "0.3 0.72 0.4 1" : CDim, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.6 0.895", AnchorMax = "0.97 0.96" }
            }, UiBody);

            // 2×2 tile grid
            const float padX = 0.025f;
            const float gapX = 0.018f;
            const float gapY = 0.018f;
            float tileW = (1f - 2f*padX - gapX) / 2f;
            float tileH = (0.89f - 0.05f - gapY) / 2f;

            for (int i = 0; i < Tiles.Length; i++) {
                var t       = Tiles[i];
                int col     = i % 2;
                int row     = i / 2;
                float x0    = padX + col * (tileW + gapX);
                float y1    = 0.89f - row * (tileH + gapY);
                float y0    = y1 - tileH;
                string tn   = $"MRAP_T{i}";
                bool future = string.IsNullOrEmpty(t.Screen);

                // Tile background
                ui.Add(new CuiPanel {
                    Image         = { Color = future ? "0.055 0.065 0.082 1" : CCell },
                    RectTransform = { AnchorMin = $"{x0:F3} {y0:F3}", AnchorMax = $"{x0+tileW:F3} {y1:F3}" }
                }, UiBody, tn);

                // Left accent bar (replaces old ugly top bar)
                ui.Add(new CuiPanel {
                    Image         = { Color = future ? "0.12 0.14 0.18 1" : t.Accent },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "0.008 1" }
                }, tn);

                // 2 item icons stacked on the right side
                if (!future && t.Items.Length > 0) {
                    for (int j = 0; j < Math.Min(2, t.Items.Length); j++) {
                        var def = ItemManager.FindItemDefinition(t.Items[j]);
                        if (def == null) continue;
                        float iy1 = 0.91f - j * 0.475f;
                        float iy0 = iy1 - 0.40f;
                        string imgN = $"{tn}_i{j}";
                        ui.Add(new CuiPanel {
                            Image         = { Color = t.AccentDim },
                            RectTransform = { AnchorMin = $"0.775 {iy0:F3}", AnchorMax = $"0.975 {iy1:F3}" }
                        }, tn, imgN);
                        ui.Add(new CuiElement {
                            Parent     = imgN,
                            Components = {
                                new CuiImageComponent { ItemId = def.itemid, SkinId = 0 },
                                new CuiRectTransformComponent { AnchorMin = "0.1 0.1", AnchorMax = "0.9 0.9" }
                            }
                        });
                    }
                }

                // Title
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Title, FontSize = 14, Align = TextAnchor.MiddleLeft, Color = future ? CDim : CText, Font = "robotocondensed-bold.ttf" },
                    RectTransform = { AnchorMin = "0.05 0.50", AnchorMax = "0.74 0.88" }
                }, tn);

                // Description
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Desc, FontSize = 10, Align = TextAnchor.UpperLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = "0.05 0.17", AnchorMax = "0.74 0.50" }
                }, tn);

                // Footer row
                if (!future) {
                    ui.Add(new CuiLabel {
                        Text          = { Text = "Open  >", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = t.Accent, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.05 0.04", AnchorMax = "0.45 0.18" }
                    }, tn);
                    ui.Add(new CuiButton {
                        Button        = { Command = $"mrap.nav {t.Screen}", Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                        Text          = { Text = "" }
                    }, tn);
                } else {
                    ui.Add(new CuiPanel {
                        Image         = { Color = "0.09 0.11 0.14 1" },
                        RectTransform = { AnchorMin = "0.05 0.06", AnchorMax = "0.24 0.20" }
                    }, tn, $"{tn}_sp");
                    ui.Add(new CuiLabel {
                        Text          = { Text = "SOON", FontSize = 8, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
                    }, $"{tn}_sp");
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
                // Empty state card
                ui.Add(new CuiPanel { Image = { Color = "0.055 0.065 0.082 1" }, RectTransform = { AnchorMin = "0.06 0.38", AnchorMax = "0.94 0.62" } }, actN, "MRAP_PAEmpty");
                ui.Add(new CuiLabel { Text = { Text = "Select a player", FontSize = 12, Align = TextAnchor.UpperCenter, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0 0.52", AnchorMax = "1 1" } }, "MRAP_PAEmpty");
                ui.Add(new CuiLabel { Text = { Text = "to see actions", FontSize = 10, Align = TextAnchor.LowerCenter, Color = "0.2 0.23 0.28 1", Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.48" } }, "MRAP_PAEmpty");
            } else {
                // ── Selected player card ──────────────────────────────────────
                ui.Add(new CuiPanel { Image = { Color = "0.05 0.065 0.085 1" }, RectTransform = { AnchorMin = "0.03 0.89", AnchorMax = "0.97 1.00" } }, actN, "MRAP_PAH");
                // Left blue accent bar
                ui.Add(new CuiPanel { Image = { Color = CBlue }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.018 1" } }, "MRAP_PAH");
                // Green online dot
                ui.Add(new CuiPanel { Image = { Color = "0.22 0.72 0.32 1" }, RectTransform = { AnchorMin = "0.06 0.40", AnchorMax = "0.115 0.60" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.displayName, FontSize = 12, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.14 0.44", AnchorMax = "0.98 0.95" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.UserIDString, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.14 0.05", AnchorMax = "0.98 0.48" } }, "MRAP_PAH");

                // ── Player stat strip ─────────────────────────────────────────
                int selHp   = sel2 != null ? (int)(sel2.health / sel2.MaxHealth() * 100f) : 0;
                int selPing = sel2 != null ? Network.Net.sv.GetAveragePing(sel2.Connection) : 0;
                ui.Add(new CuiPanel { Image = { Color = "0.05 0.06 0.08 1" }, RectTransform = { AnchorMin = "0.03 0.80", AnchorMax = "0.97 0.875" } }, actN, "MRAP_PSTAT");
                ui.Add(new CuiLabel { Text = { Text = $"HP  {selHp}%", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.10 0", AnchorMax = "0.5 1" } }, "MRAP_PSTAT");
                ui.Add(new CuiLabel { Text = { Text = $"Ping  {selPing}ms", FontSize = 9, Align = TextAnchor.MiddleRight, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.5 0", AnchorMax = "0.90 1" } }, "MRAP_PSTAT");

                // ── 2×3 action button grid ────────────────────────────────────
                string[] aCmds   = { "teleport_to",  "teleport_here", "heal",   "strip",  "kick",  "ban"  };
                string[] aLabels = { "Teleport To",  "Bring Here",    "Heal",   "Strip",  "Kick",  "Ban"  };
                string[] aClrs   = { CBlue,           CBlue,           CGreen,   COrange,  CRed,    CRed   };
                string[] aClrDs  = { CBlueDim,        CBlueDim,        CGreenDim,COrangeDim,CRedDim,CRedDim };

                const float btnW  = 0.435f;
                const float btnH  = 0.145f;
                const float btnGX = 0.02f;
                const float btnGY = 0.015f;
                float startY = 0.773f;

                for (int i = 0; i < aCmds.Length; i++) {
                    int bcol  = i % 2;
                    int brow  = i / 2;
                    float ax0 = 0.04f + bcol * (btnW + btnGX);
                    float ay1 = startY - brow * (btnH + btnGY);
                    float ay0 = ay1 - btnH;
                    string an = $"MRAP_ACT{i}";

                    ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = $"{ax0:F3} {ay0:F3}", AnchorMax = $"{ax0+btnW:F3} {ay1:F3}" } }, actN, an);
                    // Top accent line
                    ui.Add(new CuiPanel { Image = { Color = aClrs[i] }, RectTransform = { AnchorMin = "0 0.88", AnchorMax = "1 1" } }, an);
                    // Coloured dim background fill
                    ui.Add(new CuiPanel { Image = { Color = aClrDs[i] }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.88" } }, an);
                    ui.Add(new CuiLabel { Text = { Text = aLabels[i], FontSize = 11, Align = TextAnchor.MiddleCenter, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0", AnchorMax = "0.96 0.87" } }, an);
                    ui.Add(new CuiButton { Button = { Command = $"mrap.paction {aCmds[i]}", Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, an);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  SERVER SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        void DrawServerScreen(CuiElementContainer ui, S s) {
            // ── Time section ──────────────────────────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.02 0.64", AnchorMax = "0.98 0.97" } }, UiBody, "MRAP_SVT");
            ui.Add(new CuiLabel { Text = { Text = "TIME OF DAY", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0.86", AnchorMax = "0.97 0.98" } }, "MRAP_SVT");
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.03 0.83", AnchorMax = "0.97 0.845" } }, "MRAP_SVT");

            // Big clock + step buttons
            ui.Add(new CuiLabel { Text = { Text = FormatHour(s.SvTimeHour), FontSize = 26, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0.44", AnchorMax = "0.60 0.82" } }, "MRAP_SVT");
            float tMinus = ((s.SvTimeHour - 1f) + 24f) % 24f;
            float tPlus  = (s.SvTimeHour + 1f) % 24f;
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tMinus), Color = CCell }, RectTransform = { AnchorMin = "0.62 0.50", AnchorMax = "0.78 0.80" }, Text = { Text = "- 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, "MRAP_SVT");
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tPlus),  Color = CCell }, RectTransform = { AnchorMin = "0.80 0.50", AnchorMax = "0.97 0.80" }, Text = { Text = "+ 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = COrange } }, "MRAP_SVT");

            // Time preset buttons
            float[] tHours  = { 6f,     9f,        12f,    18f,    22f    };
            string[] tNames = { "Dawn", "Morning", "Noon", "Dusk", "Night" };
            for (int i = 0; i < 5; i++) {
                float tx0 = 0.02f + i * 0.191f;
                bool sel = Math.Abs(s.SvTimeHour - tHours[i]) < 0.1f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tHours[i]), Color = sel ? COrangeDim : CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.07", tx0), AnchorMax = string.Format("{0:F3} 0.41", tx0 + 0.183f) }, Text = { Text = tNames[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = sel ? COrange : CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVT");
            }

            // ── Weather section ───────────────────────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.02 0.22", AnchorMax = "0.98 0.62" } }, UiBody, "MRAP_SVW");
            ui.Add(new CuiLabel { Text = { Text = "WEATHER", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0.91", AnchorMax = "0.97 1.00" } }, "MRAP_SVW");
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.03 0.88", AnchorMax = "0.97 0.895" } }, "MRAP_SVW");

            // Weather preset buttons
            string[] wpCmds  = { "clear",  "overcast", "rain",  "fog",  "storm"  };
            string[] wpNames = { "Clear",  "Overcast", "Rain",  "Fog",  "Storm"  };
            for (int i = 0; i < 5; i++) {
                float wx0 = 0.02f + i * 0.191f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwp {0}", wpCmds[i]), Color = CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.75", wx0), AnchorMax = string.Format("{0:F3} 0.87", wx0 + 0.183f) }, Text = { Text = wpNames[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVW");
            }

            // Individual weather bars (bottom to top)
            AddWeatherBar(ui, "MRAP_SVW", "rain",   "Rain",   s.SvRain,   "0.18 0.45 0.82 0.65", 0.57f, 0.72f);
            AddWeatherBar(ui, "MRAP_SVW", "fog",    "Fog",    s.SvFog,    "0.65 0.67 0.70 0.65", 0.40f, 0.55f);
            AddWeatherBar(ui, "MRAP_SVW", "clouds", "Clouds", s.SvClouds, "0.80 0.82 0.85 0.50", 0.23f, 0.38f);
            AddWeatherBar(ui, "MRAP_SVW", "wind",   "Wind",   s.SvWind,   "0.12 0.60 0.60 0.65", 0.06f, 0.21f);

            // ── Quick actions section ─────────────────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.02 0.02", AnchorMax = "0.98 0.20" } }, UiBody, "MRAP_SVQ");
            ui.Add(new CuiLabel { Text = { Text = "QUICK ACTIONS", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0.76", AnchorMax = "0.97 0.98" } }, "MRAP_SVQ");
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.03 0.73", AnchorMax = "0.97 0.745" } }, "MRAP_SVQ");

            string[] qCmds   = { "save",         "supply",        "healall"  };
            string[] qLabels = { "Save Server",  "Supply Drop",   "Heal All" };
            string[] qClrs   = { CGreen,          COrange,         CGreen     };
            for (int i = 0; i < 3; i++) {
                float qx0 = 0.02f + i * 0.330f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svcmd {0}", qCmds[i]), Color = CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.08", qx0), AnchorMax = string.Format("{0:F3} 0.68", qx0 + 0.313f) }, Text = { Text = qLabels[i], FontSize = 11, Align = TextAnchor.MiddleCenter, Color = qClrs[i], Font = "robotocondensed-bold.ttf" } }, "MRAP_SVQ");
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        static string FormatHour(float h) {
            int hours = (int)h % 24;
            int mins  = (int)((h - (int)h) * 60f);
            string ampm = hours < 12 ? "AM" : "PM";
            int disp = hours % 12; if (disp == 0) disp = 12;
            return string.Format("{0}:{1:D2} {2}", disp, mins, ampm);
        }

        void ApplyWeather(S s, float rain, float fog, float clouds, float wind) {
            s.SvRain = rain; s.SvFog = fog; s.SvClouds = clouds; s.SvWind = wind;
            ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.rain",   rain.ToString("F2"));
            ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.fog",    fog.ToString("F2"));
            ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.clouds", clouds.ToString("F2"));
            ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.wind",   wind.ToString("F2"));
        }

        void AddWeatherBar(CuiElementContainer ui, string par, string key, string label, float value, string fillClr, float y0, float y1) {
            float pad = (y1 - y0) * 0.12f;
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 10, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = string.Format("0.03 {0:F3}", y0), AnchorMax = string.Format("0.17 {0:F3}", y1) } }, par);
            string barId = par + "_b_" + key;
            ui.Add(new CuiPanel { Image = { Color = "0.05 0.07 0.10 1" }, RectTransform = { AnchorMin = string.Format("0.18 {0:F3}", y0 + pad), AnchorMax = string.Format("0.70 {0:F3}", y1 - pad) } }, par, barId);
            if (value > 0.005f) ui.Add(new CuiPanel { Image = { Color = fillClr }, RectTransform = { AnchorMin = "0 0", AnchorMax = string.Format("{0:F3} 1", value) } }, barId);
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}%", (int)(value * 100)), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CMuted }, RectTransform = { AnchorMin = string.Format("0.71 {0:F3}", y0), AnchorMax = string.Format("0.80 {0:F3}", y1) } }, par);
            float minus = Mathf.Max(0f, value - 0.1f);
            float plus  = Mathf.Min(1f, value + 0.1f);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, minus), Color = "0.08 0.10 0.13 1" }, RectTransform = { AnchorMin = string.Format("0.81 {0:F3}", y0 + pad), AnchorMax = string.Format("0.89 {0:F3}", y1 - pad) }, Text = { Text = "-", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = CText } }, par);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, plus),  Color = "0.08 0.10 0.13 1" }, RectTransform = { AnchorMin = string.Format("0.91 {0:F3}", y0 + pad), AnchorMax = string.Format("0.99 {0:F3}", y1 - pad) }, Text = { Text = "+", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = COrange } }, par);
        }

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
