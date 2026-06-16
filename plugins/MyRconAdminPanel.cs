using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.8.0")]
    [Description("MyRcon exclusive in-game admin dashboard")]
    public class MyRconAdminPanel : RustPlugin
    {
        // ── UI layer names ────────────────────────────────────────────────────
        private const string PermUse  = "myrconadminpanel.use";
        private const string UiMain   = "MRAP_Main";
        private const string UiShadow = "MRAP_Shadow";
        private const string UiBody   = "MRAP_Body";

        // ── Screens ───────────────────────────────────────────────────────────
        private const string ScrHome    = "home";
        private const string ScrGive    = "give";
        private const string ScrPlayers = "players";
        private const string ScrServer  = "server";

        // ── Palette ───────────────────────────────────────────────────────────
        // Three distinct depth layers — clearly different so hierarchy reads
        private const string CBg         = "0.038 0.046 0.062 0.97";  // modal bg — near-black blue-grey
        private const string CHeader     = "0.026 0.032 0.046 1";      // header — deepest dark
        private const string CPanel      = "0.068 0.082 0.108 1";      // card bg — one step up
        private const string CCell       = "0.100 0.122 0.158 1";      // item/row cells — lighter still
        private const string CCellSel    = "0.20 0.10 0.02 1";         // orange-tinted selected cell
        private const string CDivider    = "1 1 1 0.07";
        // Accent colours
        private const string COrange     = "0.96 0.44 0.08 1";
        private const string COrangeDim  = "0.96 0.44 0.08 0.16";
        private const string COrangeDeep = "0.24 0.11 0.02 1";
        private const string CBlue       = "0.22 0.50 0.88 1";
        private const string CBlueDim    = "0.22 0.50 0.88 0.16";
        private const string CBlueDeep   = "0.04 0.10 0.22 1";
        private const string CGreen      = "0.24 0.70 0.36 1";
        private const string CGreenDim   = "0.24 0.70 0.36 0.16";
        private const string CGreenDeep  = "0.04 0.14 0.08 1";
        private const string CRed        = "0.78 0.20 0.14 1";
        private const string CRedDim     = "0.78 0.20 0.14 0.18";
        private const string CRedDeep    = "0.18 0.05 0.04 1";
        // Text
        private const string CText       = "0.95 0.96 0.98 1";
        private const string CMuted      = "0.62 0.67 0.74 1";
        private const string CDim        = "0.40 0.45 0.52 1";
        private const string CBtnOff     = "0.09 0.11 0.15 1";
        private const string CCooldown   = "0.55 0.18 0.08 1";

        // ── Plugin version ────────────────────────────────────────────────────
        private const string PluginVersion = "1.8.0";

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
            public string   Screen       = ScrHome;
            public string   Cat          = "All";
            public int      GivePage     = 0;
            public string   Item         = null;
            public string   ItemName     = null;
            public int      Stack        = 1;
            public ulong    GiveTarget   = 0;
            public string   Amt          = "100";
            public int      Custom       = 100;
            public DateTime LastGiveAt   = DateTime.MinValue;
            public int      PlayerPage   = 0;
            public ulong    PlayerSel    = 0;
            public float    SvTimeHour   = 12f;
            public float    SvRain       = 0f;
            public float    SvFog        = 0f;
            public float    SvClouds     = 0f;
            public float    SvWind       = 0f;
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
        void Unload() { foreach (var p in BasePlayer.activePlayerList) { CuiHelper.DestroyUi(p, UiShadow); CuiHelper.DestroyUi(p, UiMain); } _s.Clear(); }
        void OnPlayerDisconnected(BasePlayer p, string r) { CuiHelper.DestroyUi(p, UiShadow); CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID); }
        void OnPlayerSleepEnded(BasePlayer p) { CuiHelper.DestroyUi(p, UiShadow); CuiHelper.DestroyUi(p, UiMain); }

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
            CuiHelper.DestroyUi(p, UiShadow); CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID);
        }

        [ConsoleCommand("mrap.nav")]
        void CmdNav(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); s.Screen = a.GetString(0);
            if (s.Screen == ScrGive)    { s.Item = null; s.GiveTarget = 0; }
            if (s.Screen == ScrPlayers) { s.PlayerSel = 0; s.PlayerPage = 0; }
            Draw(p, force: true);
        }

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
            Puts($"[AdminPanel] {p.displayName} gave {amt}x {s.Item} -> {tgt.displayName}");
            SendReply(p, $"<color=#F06A0F>MyRcon</color>: Gave <color=#fff>{amt:N0}x</color> <color=#F06A0F>{s.ItemName}</color> to <color=#fff>{tgt.displayName}</color>.");
            s.GiveTarget = 0; Draw(p, force: true);
        }

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

            CuiHelper.DestroyUi(player, UiShadow);
            CuiHelper.DestroyUi(player, UiMain);
            var ui = new CuiElementContainer();

            // Thin orange border frame sits behind main panel
            ui.Add(new CuiPanel {
                Image         = { Color = "0.96 0.44 0.08 0.28" },
                RectTransform = { AnchorMin = "0.1492 0.0792", AnchorMax = "0.8508 0.9308" },
                CursorEnabled = false
            }, "Overlay", UiShadow);

            // Main modal
            ui.Add(new CuiPanel {
                Image           = { Color = CBg },
                RectTransform   = { AnchorMin = "0.15 0.08", AnchorMax = "0.85 0.93" },
                CursorEnabled   = true,
                KeyboardEnabled = false
            }, "Overlay", UiMain);

            DrawHeader(ui, s);

            // Body (below header)
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.942" }
            }, UiMain, UiBody);

            switch (s.Screen) {
                case ScrHome:    DrawHome(ui, s);               break;
                case ScrGive:    DrawGiveScreen(ui, s, player); break;
                case ScrPlayers: DrawPlayersScreen(ui, s, player); break;
                case ScrServer:  DrawServerScreen(ui, s);       break;
            }

            CuiHelper.AddUi(player, ui);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  HEADER
        // ═══════════════════════════════════════════════════════════════════════

        void DrawHeader(CuiElementContainer ui, S s) {
            // Header bar
            ui.Add(new CuiPanel {
                Image         = { Color = CHeader },
                RectTransform = { AnchorMin = "0 0.945", AnchorMax = "1 1" }
            }, UiMain, "MRAP_H");

            // Full-width orange accent line at bottom of header
            ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.048" } }, "MRAP_H");

            // Logo: solid orange block with dark "MR" text
            ui.Add(new CuiPanel {
                Image         = { Color = COrange },
                RectTransform = { AnchorMin = "0 0.048", AnchorMax = "0.056 1" }
            }, "MRAP_H", "MRAP_Logo");
            ui.Add(new CuiLabel {
                Text          = { Text = "MR", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = "0.06 0.03 0.01 1", Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
            }, "MRAP_Logo");

            float xC = 0.063f;

            // App name
            ui.Add(new CuiLabel {
                Text          = { Text = "MyRcon", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = string.Format("{0:F3} 0.10", xC), AnchorMax = string.Format("{0:F3} 0.92", xC + 0.090f) }
            }, "MRAP_H");
            xC += 0.096f;

            // Back chip + breadcrumb (non-home screens)
            if (s.Screen != ScrHome) {
                ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.22", xC), AnchorMax = string.Format("{0:F3} 0.78", xC + 0.002f) } }, "MRAP_H");
                xC += 0.009f;
                ui.Add(new CuiButton {
                    Button        = { Command = "mrap.nav home", Color = "0.075 0.095 0.130 1" },
                    RectTransform = { AnchorMin = string.Format("{0:F3} 0.17", xC), AnchorMax = string.Format("{0:F3} 0.83", xC + 0.078f) },
                    Text          = { Text = "< Back", FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-regular.ttf" }
                }, "MRAP_H");
                xC += 0.086f;
                ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.22", xC), AnchorMax = string.Format("{0:F3} 0.78", xC + 0.002f) } }, "MRAP_H");
                xC += 0.009f;
                string title = s.Screen == ScrGive ? "Give Items" : s.Screen == ScrPlayers ? "Players" : s.Screen == ScrServer ? "Server" : "";
                if (title.Length > 0) {
                    ui.Add(new CuiLabel {
                        Text          = { Text = title, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" },
                        RectTransform = { AnchorMin = string.Format("{0:F3} 0.10", xC), AnchorMax = "0.72 0.92" }
                    }, "MRAP_H");
                }
            }

            // Online badge (green pill)
            int online = BasePlayer.activePlayerList.Count;
            string onClr = online > 0 ? CGreen : CDim;
            string onBg  = online > 0 ? "0.04 0.15 0.08 1" : "0.08 0.10 0.13 1";
            ui.Add(new CuiPanel { Image = { Color = onBg }, RectTransform = { AnchorMin = "0.720 0.19", AnchorMax = "0.845 0.81" } }, "MRAP_H", "MRAP_OB");
            ui.Add(new CuiPanel { Image = { Color = onClr }, RectTransform = { AnchorMin = "0.07 0.34", AnchorMax = "0.17 0.66" } }, "MRAP_OB");
            ui.Add(new CuiLabel {
                Text          = { Text = string.Format("{0} online", online), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = onClr, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.14 0", AnchorMax = "0.97 1" }
            }, "MRAP_OB");

            // Version badge (orange deep pill)
            ui.Add(new CuiPanel { Image = { Color = COrangeDeep }, RectTransform = { AnchorMin = "0.851 0.19", AnchorMax = "0.930 0.81" } }, "MRAP_H", "MRAP_VB");
            ui.Add(new CuiLabel {
                Text          = { Text = "v" + PluginVersion, FontSize = 9, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
            }, "MRAP_VB");

            // Close button
            ui.Add(new CuiButton {
                Button        = { Command = "mrap.close", Color = "0.46 0.06 0.04 1" },
                RectTransform = { AnchorMin = "0.937 0.13", AnchorMax = "0.998 0.87" },
                Text          = { Text = "X", FontSize = 12, Align = TextAnchor.MiddleCenter, Color = "1 0.50 0.44 1", Font = "robotocondensed-bold.ttf" }
            }, "MRAP_H");
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  HOME SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private struct Tile { public string Screen; public string Title; public string Desc; public string Letter; public string Accent; public string AccentDim; public string AccentDeep; }

        private static readonly Tile[] Tiles = {
            new Tile { Screen = ScrGive,    Title = "Give Items",  Desc = "Give items & kits to online players",      Letter = "G", Accent = COrange, AccentDim = COrangeDim, AccentDeep = COrangeDeep },
            new Tile { Screen = ScrPlayers, Title = "Players",     Desc = "Manage, teleport, heal, kick & ban",        Letter = "P", Accent = CBlue,   AccentDim = CBlueDim,   AccentDeep = CBlueDeep   },
            new Tile { Screen = ScrServer,  Title = "Server",      Desc = "Commands, weather & maintenance tools",     Letter = "S", Accent = CGreen,  AccentDim = CGreenDim,  AccentDeep = CGreenDeep  },
            new Tile { Screen = "",         Title = "Coming Soon", Desc = "More modules being added",                  Letter = "?", Accent = CDim,    AccentDim = "0 0 0 0",  AccentDeep = "0.052 0.062 0.080 1" },
        };

        void DrawHome(CuiElementContainer ui, S s) {
            // Section label
            ui.Add(new CuiLabel {
                Text          = { Text = "Admin Dashboard", FontSize = 12, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.030 0.930", AnchorMax = "0.700 0.975" }
            }, UiBody);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.025 0.924", AnchorMax = "0.975 0.930" } }, UiBody);

            // 2x2 tile grid
            const float padX = 0.024f;
            const float gapX = 0.020f;
            const float gapY = 0.018f;
            float tileW = (1f - 2f * padX - gapX) / 2f;
            float tileH = (0.920f - 0.026f - gapY) / 2f;

            for (int i = 0; i < Tiles.Length; i++) {
                var t      = Tiles[i];
                int col    = i % 2;
                int row    = i / 2;
                float x0   = padX + col * (tileW + gapX);
                float y1   = 0.920f - row * (tileH + gapY);
                float y0   = y1 - tileH;
                string tn  = string.Format("MRAP_T{0}", i);
                bool future = string.IsNullOrEmpty(t.Screen);

                // Card shell
                ui.Add(new CuiPanel {
                    Image         = { Color = CPanel },
                    RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", x0, y0), AnchorMax = string.Format("{0:F3} {1:F3}", x0 + tileW, y1) }
                }, UiBody, tn);

                // Top colored section (upper 56%)
                string topBg = future ? "0.052 0.062 0.082 1" : t.AccentDeep;
                ui.Add(new CuiPanel {
                    Image         = { Color = topBg },
                    RectTransform = { AnchorMin = "0 0.456", AnchorMax = "1 1" }
                }, tn, string.Format("{0}_T", tn));

                // Subtle inner highlight at very top (simulates depth/lift)
                ui.Add(new CuiPanel { Image = { Color = "1 1 1 0.028" }, RectTransform = { AnchorMin = "0 0.94", AnchorMax = "1 1" } }, string.Format("{0}_T", tn));

                // Large letter — the module's identity
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Letter, FontSize = 40, Align = TextAnchor.MiddleCenter, Color = future ? "0.28 0.32 0.38 1" : t.Accent, Font = "robotocondensed-bold.ttf" },
                    RectTransform = { AnchorMin = "0.10 0.10", AnchorMax = "0.90 0.90" }
                }, string.Format("{0}_T", tn));

                // Accent separator line between top and bottom
                ui.Add(new CuiPanel {
                    Image         = { Color = future ? "1 1 1 0.045" : t.Accent },
                    RectTransform = { AnchorMin = "0 0.450", AnchorMax = "1 0.460" }
                }, tn);

                // Bottom section: title
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Title, FontSize = 16, Align = TextAnchor.UpperLeft, Color = future ? CDim : CText, Font = "robotocondensed-bold.ttf" },
                    RectTransform = { AnchorMin = "0.072 0.265", AnchorMax = "0.965 0.438" }
                }, tn);

                // Description
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Desc, FontSize = 10, Align = TextAnchor.UpperLeft, Color = future ? "0.32 0.36 0.42 1" : CMuted, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = "0.072 0.115", AnchorMax = "0.965 0.270" }
                }, tn);

                if (!future) {
                    // "Open >" CTA — right-aligned, accent colour
                    ui.Add(new CuiLabel {
                        Text          = { Text = "Open  >", FontSize = 10, Align = TextAnchor.MiddleRight, Color = t.Accent, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.55 0.022", AnchorMax = "0.965 0.112" }
                    }, tn);
                    // Invisible button over whole card
                    ui.Add(new CuiButton {
                        Button        = { Command = string.Format("mrap.nav {0}", t.Screen), Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                        Text          = { Text = "" }
                    }, tn);
                } else {
                    // Coming soon pill
                    ui.Add(new CuiPanel {
                        Image         = { Color = CCell },
                        RectTransform = { AnchorMin = "0.072 0.032", AnchorMax = "0.380 0.108" }
                    }, tn, string.Format("{0}_pill", tn));
                    ui.Add(new CuiLabel {
                        Text          = { Text = "COMING SOON", FontSize = 7, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
                    }, string.Format("{0}_pill", tn));
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
                RectTransform = { AnchorMin = string.Format("0 0.895"), AnchorMax = string.Format("{0:F3} 0.942", xRight) }
            }, UiBody, tabsN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.055" } }, tabsN);

            float tabW = 1f / AllCats.Count;
            for (int i = 0; i < AllCats.Count; i++) {
                string cat = AllCats[i]; bool active = s.Cat == cat;
                float xMin = i * tabW; float xMax = xMin + tabW;
                if (active) {
                    ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.07", xMin), AnchorMax = string.Format("{0:F3} 1", xMax) } }, tabsN);
                    ui.Add(new CuiPanel { Image = { Color = COrange },    RectTransform = { AnchorMin = string.Format("{0:F3} 0",    xMin), AnchorMax = string.Format("{0:F3} 0.10", xMax) } }, tabsN);
                }
                ui.Add(new CuiButton {
                    Button        = { Command = string.Format("mrap.cat {0}", cat), Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = string.Format("{0:F3} 0.07", xMin), AnchorMax = string.Format("{0:F3} 1", xMax) },
                    Text          = { Text = cat, FontSize = 10, Align = TextAnchor.MiddleCenter, Color = active ? "1 0.84 0.64 1" : CMuted, Font = "robotocondensed-regular.ttf" }
                }, tabsN);
            }

            // Item grid
            string gridN = "MRAP_Grid";
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0.05", AnchorMax = string.Format("{0:F3} 0.893", xRight) }
            }, UiBody, gridN);

            var items = ItemsFor(s.Cat);
            int pages = Math.Max(1, (int)Math.Ceiling(items.Count / (float)PerPage));
            s.GivePage = Mathf.Clamp(s.GivePage, 0, pages - 1);
            var page = items.Skip(s.GivePage * PerPage).Take(PerPage).ToList();

            const float gX = 0.008f; const float gY = 0.010f; const float bH = 0.090f;
            float cW = (1f - gX * (GridCols + 1)) / GridCols;
            float cH = (1f - bH - gY * (GridRows + 1)) / GridRows;

            for (int i = 0; i < page.Count; i++) {
                string sn = page[i]; var def = ItemManager.FindItemDefinition(sn); if (def == null) continue;
                int col = i % GridCols; int row = i / GridCols;
                float xMin = gX + col * (cW + gX);
                float yMin = bH + gY + (GridRows - 1 - row) * (cH + gY);
                bool sel = s.Item == sn; string cn = string.Format("MRAP_I{0}", i);

                ui.Add(new CuiPanel { Image = { Color = sel ? CCellSel : CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", xMin, yMin), AnchorMax = string.Format("{0:F3} {1:F3}", xMin + cW, yMin + cH) } }, gridN, cn);
                if (sel) ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.025 1" } }, cn);
                ui.Add(new CuiElement { Parent = cn, Components = {
                    new CuiImageComponent { ItemId = def.itemid, SkinId = 0 },
                    new CuiRectTransformComponent { AnchorMin = "0.10 0.28", AnchorMax = "0.90 0.94" }
                }});
                ui.Add(new CuiLabel { Text = { Text = def.displayName.translated, FontSize = 8, Align = TextAnchor.MiddleCenter, Color = sel ? "1 0.84 0.64 1" : CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.02 0.01", AnchorMax = "0.98 0.28" } }, cn);
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.item {0}", sn), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, cn);
            }

            // Pagination bar
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}  -  {1} items  -  page {2}/{3}", s.Cat, items.Count, s.GivePage + 1, pages), FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.01 0.005", AnchorMax = "0.55 0.075" } }, gridN);
            if (s.GivePage > 0)        ui.Add(new CuiButton { Button = { Command = string.Format("mrap.page {0}", s.GivePage - 1), Color = CCell }, RectTransform = { AnchorMin = "0.57 0.008", AnchorMax = "0.77 0.078" }, Text = { Text = "< Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);
            if (s.GivePage < pages - 1) ui.Add(new CuiButton { Button = { Command = string.Format("mrap.page {0}", s.GivePage + 1), Color = CCell }, RectTransform = { AnchorMin = "0.79 0.008", AnchorMax = "0.998 0.078" }, Text = { Text = "Next >", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);

            if (s.Item != null) DrawGivePanel(ui, s, invoker, GiveCooldownLeft(s));
        }

        void DrawGivePanel(CuiElementContainer ui, S s, BasePlayer invoker, double cd) {
            string gp = "MRAP_GP";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.66 0", AnchorMax = "1 0.942" } }, UiBody, gp);
            // Left divider line
            ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0 0.01", AnchorMax = "0.006 0.99" } }, gp);

            // Item header card
            ui.Add(new CuiPanel { Image = { Color = "0.048 0.058 0.076 1" }, RectTransform = { AnchorMin = "0.025 0.900", AnchorMax = "0.975 0.990" } }, gp, "MRAP_GH");
            // Orange left bar on item header
            ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.018 1" } }, "MRAP_GH");
            var hdef = ItemManager.FindItemDefinition(s.Item);
            if (hdef != null) ui.Add(new CuiElement { Parent = "MRAP_GH", Components = { new CuiImageComponent { ItemId = hdef.itemid, SkinId = 0 }, new CuiRectTransformComponent { AnchorMin = "0.06 0.10", AnchorMax = "0.24 0.90" } } });
            ui.Add(new CuiLabel { Text = { Text = s.ItemName ?? s.Item, FontSize = 12, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.28 0.48", AnchorMax = "0.98 0.94" } }, "MRAP_GH");
            ui.Add(new CuiLabel { Text = { Text = s.Item, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.28 0.06", AnchorMax = "0.98 0.50" } }, "MRAP_GH");

            // Section label: GIVE TO
            ui.Add(new CuiLabel { Text = { Text = "GIVE TO", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.853", AnchorMax = "0.95 0.895" } }, gp);

            // Player rows
            var players = BasePlayer.activePlayerList.OrderBy(p => p.userID != invoker.userID).ThenBy(p => p.displayName).ToList();
            const float rH = 0.058f; const float rGap = 0.005f; float rTop = 0.850f; const int maxR = 8;
            for (int i = 0; i < Math.Min(players.Count, maxR); i++) {
                var pl = players[i]; bool inv = pl.userID == invoker.userID; bool sel = s.GiveTarget == pl.userID;
                float yMx = rTop - i * (rH + rGap); float yMn = yMx - rH; string rn = string.Format("MRAP_PR{0}", i);
                ui.Add(new CuiPanel { Image = { Color = sel ? "0.16 0.09 0.02 1" : "0.075 0.092 0.118 1" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", yMn), AnchorMax = string.Format("0.96 {0:F3}", yMx) } }, gp, rn);
                ui.Add(new CuiPanel { Image = { Color = sel ? COrange : CDivider }, RectTransform = { AnchorMin = "0 0.12", AnchorMax = "0.014 0.88" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = pl.displayName, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = sel ? "1 0.84 0.64 1" : CText, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.06 0", AnchorMax = inv ? "0.70 1" : "0.97 1" } }, rn);
                if (inv) {
                    ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0.72 0.18", AnchorMax = "0.98 0.82" } }, rn);
                    ui.Add(new CuiLabel { Text = { Text = "YOU", FontSize = 7, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.72 0.18", AnchorMax = "0.98 0.82" } }, rn);
                }
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.target {0}", pl.userID), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }
            if (players.Count > maxR) ui.Add(new CuiLabel { Text = { Text = string.Format("+{0} more online", players.Count - maxR), FontSize = 8, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0.04 0.375", AnchorMax = "0.96 0.415" } }, gp);

            // Amount section
            ui.Add(new CuiLabel { Text = { Text = "AMOUNT", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.337", AnchorMax = "0.95 0.374" } }, gp);
            var modes = new (string m, string l)[] { ("100","100"), ("1000","1,000"), ("stack",string.Format("Stack ({0})", s.Stack)), ("custom","Custom") };
            const float bH2 = 0.062f; const float bGap = 0.010f; float bTop = 0.334f;
            for (int i = 0; i < 4; i++) {
                var (m, l) = modes[i]; bool on = s.Amt == m;
                int col = i % 2; int row = i / 2;
                float xMn = 0.04f + col * (0.475f + bGap); float yMx = bTop - row * (bH2 + bGap); float yMn2 = yMx - bH2;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.amt {0}", m), Color = on ? COrangeDim : "0.082 0.100 0.132 1" }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", xMn, yMn2), AnchorMax = string.Format("{0:F3} {1:F3}", xMn + 0.475f, yMx) }, Text = { Text = l, FontSize = 10, Align = TextAnchor.MiddleCenter, Color = on ? "1 0.84 0.64 1" : CMuted, Font = "robotocondensed-regular.ttf" } }, gp);
            }

            float baseY = bTop - 2 * (bH2 + bGap);
            if (s.Amt == "custom") {
                ui.Add(new CuiPanel { Image = { Color = "0.082 0.100 0.132 1" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", baseY - 0.072f), AnchorMax = string.Format("0.96 {0:F3}", baseY) } }, gp, "MRAP_In");
                ui.Add(new CuiElement { Name = "MRAP_InF", Parent = "MRAP_In", Components = {
                    new CuiInputFieldComponent { Text = s.Custom.ToString(), FontSize = 13, Align = TextAnchor.MiddleCenter, Command = "mrap.custom", Color = CText, CharsLimit = 6 },
                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                }});
                baseY -= 0.080f;
            }

            int res = Resolve(s);
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}x  {1}", res.ToString("N0"), s.ItemName ?? s.Item), FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", baseY - 0.040f), AnchorMax = string.Format("0.96 {0:F3}", baseY) } }, gp);

            // Give button
            bool can = s.GiveTarget != 0; bool onCd = cd > 0;
            string btnCmd   = (can && !onCd) ? "mrap.give" : "";
            string btnColor = onCd ? CCooldown : (can ? COrange : "0.082 0.100 0.132 1");
            string btnLabel = onCd ? string.Format("Wait  {0:F1}s...", cd) : can ? string.Format("Give  {0}x", res.ToString("N0")) : "Select a player above";
            string btnTxtClr = (can && !onCd) ? "1 1 1 1" : CDim;
            ui.Add(new CuiButton { Button = { Command = btnCmd, Color = btnColor }, RectTransform = { AnchorMin = "0.04 0.022", AnchorMax = "0.96 0.100" }, Text = { Text = btnLabel, FontSize = 12, Align = TextAnchor.MiddleCenter, Color = btnTxtClr, Font = "robotocondensed-bold.ttf" } }, gp);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  PLAYERS SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private const int PlayersPerPage = 10;

        void DrawPlayersScreen(CuiElementContainer ui, S s, BasePlayer invoker) {
            var allPlayers  = BasePlayer.activePlayerList.OrderBy(p => p.displayName).ToList();
            int pages       = Math.Max(1, (int)Math.Ceiling(allPlayers.Count / (float)PlayersPerPage));
            s.PlayerPage    = Mathf.Clamp(s.PlayerPage, 0, pages - 1);
            var pagePlayers = allPlayers.Skip(s.PlayerPage * PlayersPerPage).Take(PlayersPerPage).ToList();

            // ── Left: player list ─────────────────────────────────────────────
            string listN = "MRAP_PL";
            ui.Add(new CuiPanel { Image = { Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0.045", AnchorMax = "0.575 0.975" } }, UiBody, listN);

            // List header
            ui.Add(new CuiLabel { Text = { Text = string.Format("Online  -  {0}", allPlayers.Count), FontSize = 12, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.022 0.940", AnchorMax = "0.780 1" } }, listN);
            ui.Add(new CuiLabel { Text = { Text = "PING", FontSize = 9, Align = TextAnchor.MiddleRight, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.780 0.940", AnchorMax = "0.980 1" } }, listN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0.932", AnchorMax = "1 0.938" } }, listN);

            const float rH = 0.085f; const float rG = 0.007f;
            for (int i = 0; i < pagePlayers.Count; i++) {
                var pl    = pagePlayers[i];
                bool self = pl.userID == invoker.userID;
                bool sel  = s.PlayerSel == pl.userID;
                float y1  = 0.928f - i * (rH + rG);
                float y0  = y1 - rH;
                string rn = string.Format("MRAP_PLR{0}", i);

                ui.Add(new CuiPanel { Image = { Color = sel ? CBlueDeep : CCell }, RectTransform = { AnchorMin = string.Format("0 {0:F3}", y0), AnchorMax = string.Format("1 {0:F3}", y1) } }, listN, rn);
                // Left accent bar
                ui.Add(new CuiPanel { Image = { Color = sel ? CBlue : CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.009 1" } }, rn);
                // Online dot
                ui.Add(new CuiPanel { Image = { Color = "0.24 0.74 0.34 1" }, RectTransform = { AnchorMin = "0.022 0.35", AnchorMax = "0.040 0.65" } }, rn);
                // Name
                ui.Add(new CuiLabel { Text = { Text = pl.displayName + (self ? "  (you)" : ""), FontSize = 12, Align = TextAnchor.MiddleLeft, Color = sel ? "0.80 0.92 1 1" : CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.055 0.36", AnchorMax = "0.780 1" } }, rn);
                // Steam ID
                ui.Add(new CuiLabel { Text = { Text = pl.UserIDString, FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.055 0", AnchorMax = "0.780 0.38" } }, rn);
                // Ping
                int ping = Network.Net.sv.GetAveragePing(pl.Connection);
                string pingClr = ping < 80 ? "0.30 0.74 0.40 1" : ping < 150 ? "0.92 0.78 0.22 1" : "0.88 0.32 0.28 1";
                ui.Add(new CuiLabel { Text = { Text = ping + "ms", FontSize = 10, Align = TextAnchor.MiddleRight, Color = pingClr, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.780 0", AnchorMax = "0.975 1" } }, rn);

                if (!self) ui.Add(new CuiButton { Button = { Command = string.Format("mrap.psel {0}", pl.userID), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }

            if (allPlayers.Count == 0)
                ui.Add(new CuiLabel { Text = { Text = "No players online", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0 0.35", AnchorMax = "1 0.65" } }, listN);

            // Pagination
            ui.Add(new CuiLabel { Text = { Text = string.Format("Page {0} / {1}", s.PlayerPage + 1, pages), FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim }, RectTransform = { AnchorMin = "0.022 0.002", AnchorMax = "0.500 0.042" } }, listN);
            if (s.PlayerPage > 0)       ui.Add(new CuiButton { Button = { Command = string.Format("mrap.ppage {0}", s.PlayerPage - 1), Color = CCell }, RectTransform = { AnchorMin = "0.500 0.002", AnchorMax = "0.730 0.042" }, Text = { Text = "<  Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);
            if (s.PlayerPage < pages-1) ui.Add(new CuiButton { Button = { Command = string.Format("mrap.ppage {0}", s.PlayerPage + 1), Color = CCell }, RectTransform = { AnchorMin = "0.755 0.002", AnchorMax = "0.985 0.042" }, Text = { Text = "Next  >", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);

            // ── Right: action panel ───────────────────────────────────────────
            string actN = "MRAP_PA";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.595 0", AnchorMax = "1 0.975" } }, UiBody, actN);
            ui.Add(new CuiPanel { Image = { Color = CBlueDim }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.005 1" } }, actN);

            var sel2 = s.PlayerSel != 0 ? BasePlayer.FindByID(s.PlayerSel) : null;

            if (sel2 == null) {
                // Empty state prompt
                ui.Add(new CuiLabel { Text = { Text = "Select a player", FontSize = 14, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.46", AnchorMax = "0.95 0.56" } }, actN);
                ui.Add(new CuiLabel { Text = { Text = "from the list on the left", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.40", AnchorMax = "0.95 0.46" } }, actN);
            } else {
                // Player card
                ui.Add(new CuiPanel { Image = { Color = CBlueDeep }, RectTransform = { AnchorMin = "0.030 0.895", AnchorMax = "0.970 0.990" } }, actN, "MRAP_PAH");
                ui.Add(new CuiPanel { Image = { Color = CBlue }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.016 1" } }, "MRAP_PAH");
                // Online dot
                ui.Add(new CuiPanel { Image = { Color = "0.24 0.74 0.34 1" }, RectTransform = { AnchorMin = "0.065 0.36", AnchorMax = "0.092 0.64" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.displayName, FontSize = 13, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.115 0.44", AnchorMax = "0.98 0.94" } }, "MRAP_PAH");
                ui.Add(new CuiLabel { Text = { Text = sel2.UserIDString, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.115 0.06", AnchorMax = "0.98 0.46" } }, "MRAP_PAH");

                // Stat strip
                int hp  = (int)(sel2.health / sel2.MaxHealth() * 100f);
                int pms = Network.Net.sv.GetAveragePing(sel2.Connection);
                ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = "0.030 0.818", AnchorMax = "0.970 0.886" } }, actN, "MRAP_PST");
                ui.Add(new CuiLabel { Text = { Text = string.Format("HP   {0}%", hp), FontSize = 11, Align = TextAnchor.MiddleLeft, Color = hp > 50 ? CGreen : hp > 25 ? COrange : CRed, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.08 0", AnchorMax = "0.50 1" } }, "MRAP_PST");
                ui.Add(new CuiLabel { Text = { Text = string.Format("Ping   {0}ms", pms), FontSize = 11, Align = TextAnchor.MiddleRight, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.50 0", AnchorMax = "0.92 1" } }, "MRAP_PST");

                // 2x3 action grid
                string[] aCmds   = { "teleport_to", "teleport_here", "heal",   "strip",  "kick", "ban"  };
                string[] aLabels = { "Teleport To", "Bring Here",    "Heal",   "Strip",  "Kick", "Ban"  };
                string[] aBg     = { CBlueDeep,      CBlueDeep,       CGreenDeep, COrangeDeep, CRedDeep, CRedDeep };
                string[] aAccent = { CBlue,           CBlue,           CGreen,   COrange,  CRed,   CRed   };

                const float bW = 0.438f; const float bH = 0.136f;
                const float bGX = 0.020f; const float bGY = 0.012f;
                float sY = 0.794f;

                for (int i = 0; i < aCmds.Length; i++) {
                    int bc  = i % 2; int br = i / 2;
                    float ax0 = 0.030f + bc * (bW + bGX);
                    float ay1 = sY - br * (bH + bGY);
                    float ay0 = ay1 - bH;
                    string an = string.Format("MRAP_ACT{0}", i);

                    ui.Add(new CuiPanel { Image = { Color = aBg[i] }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", ax0, ay0), AnchorMax = string.Format("{0:F3} {1:F3}", ax0 + bW, ay1) } }, actN, an);
                    // Left accent bar on action button
                    ui.Add(new CuiPanel { Image = { Color = aAccent[i] }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.026 1" } }, an);
                    ui.Add(new CuiLabel { Text = { Text = aLabels[i], FontSize = 12, Align = TextAnchor.MiddleLeft, Color = aAccent[i], Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.10 0", AnchorMax = "0.97 1" } }, an);
                    ui.Add(new CuiButton { Button = { Command = string.Format("mrap.paction {0}", aCmds[i]), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, an);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  SERVER SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        void DrawServerScreen(CuiElementContainer ui, S s) {
            // ── Left column: Time + Quick Actions ─────────────────────────────
            // Time section
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.020 0.480", AnchorMax = "0.485 0.975" } }, UiBody, "MRAP_SVT");
            SectionHeader(ui, "MRAP_SVT", "TIME OF DAY");

            // Large clock display
            ui.Add(new CuiLabel { Text = { Text = FormatHour(s.SvTimeHour), FontSize = 28, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.06 0.56", AnchorMax = "0.68 0.82" } }, "MRAP_SVT");

            // +/- hour buttons
            float tMinus = ((s.SvTimeHour - 1f) + 24f) % 24f;
            float tPlus  = (s.SvTimeHour + 1f) % 24f;
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tMinus), Color = CCell }, RectTransform = { AnchorMin = "0.62 0.60", AnchorMax = "0.80 0.80" }, Text = { Text = "- 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, "MRAP_SVT");
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tPlus),  Color = COrangeDeep }, RectTransform = { AnchorMin = "0.82 0.60", AnchorMax = "1.00 0.80" }, Text = { Text = "+ 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = COrange } }, "MRAP_SVT");

            // Time preset pills (2 rows of 3 — avoids overcrowding single row)
            float[] tHrs  = { 6f,    9f,       12f,   18f,   22f   };
            string[] tNms = { "Dawn","Morning","Noon","Dusk","Night" };
            for (int i = 0; i < 5; i++) {
                int tc = i % 3; int tr = i / 3;
                float tw = 0.285f; float tgx = 0.025f; float tgy = 0.075f;
                float tx0 = 0.040f + tc * (tw + tgx);
                float ty1 = 0.540f - tr * (0.120f + tgy);
                float ty0 = ty1 - 0.120f;
                bool tsel = Math.Abs(s.SvTimeHour - tHrs[i]) < 0.1f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tHrs[i]), Color = tsel ? COrangeDeep : CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", tx0, ty0), AnchorMax = string.Format("{0:F3} {1:F3}", tx0 + tw, ty1) }, Text = { Text = tNms[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = tsel ? COrange : CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVT");
            }

            // Quick actions section
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.020 0.020", AnchorMax = "0.485 0.465" } }, UiBody, "MRAP_SVQ");
            SectionHeader(ui, "MRAP_SVQ", "QUICK ACTIONS");

            string[] qCmds   = { "save",        "supply",       "healall"  };
            string[] qLabels = { "Save Server", "Supply Drop",  "Heal All" };
            string[] qBg     = { CGreenDeep,     COrangeDeep,    CGreenDeep };
            string[] qClrs   = { CGreen,          COrange,        CGreen     };
            for (int i = 0; i < 3; i++) {
                float qy1 = 0.760f - i * 0.230f;
                float qy0 = qy1 - 0.190f;
                string qn = string.Format("MRAP_QA{0}", i);
                ui.Add(new CuiPanel { Image = { Color = qBg[i] }, RectTransform = { AnchorMin = string.Format("0.040 {0:F3}", qy0), AnchorMax = string.Format("0.960 {0:F3}", qy1) } }, "MRAP_SVQ", qn);
                ui.Add(new CuiPanel { Image = { Color = qClrs[i] }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.020 1" } }, qn);
                ui.Add(new CuiLabel { Text = { Text = qLabels[i], FontSize = 12, Align = TextAnchor.MiddleLeft, Color = qClrs[i], Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.08 0", AnchorMax = "0.98 1" } }, qn);
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svcmd {0}", qCmds[i]), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, qn);
            }

            // ── Right column: Weather ─────────────────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.515 0.020", AnchorMax = "0.980 0.975" } }, UiBody, "MRAP_SVW");
            SectionHeader(ui, "MRAP_SVW", "WEATHER");

            // Weather preset pills
            string[] wpCmds  = { "clear", "overcast", "rain", "fog", "storm" };
            string[] wpNames = { "Clear", "Overcast", "Rain", "Fog", "Storm" };
            for (int i = 0; i < 5; i++) {
                float wx0 = 0.030f + i * 0.188f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwp {0}", wpCmds[i]), Color = CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.780", wx0), AnchorMax = string.Format("{0:F3} 0.875", wx0 + 0.178f) }, Text = { Text = wpNames[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVW");
            }

            // Weather bars
            AddWeatherBar(ui, "MRAP_SVW", "rain",   "Rain",   s.SvRain,   "0.22 0.50 0.88 0.70", 0.585f, 0.745f);
            AddWeatherBar(ui, "MRAP_SVW", "fog",    "Fog",    s.SvFog,    "0.68 0.70 0.74 0.65", 0.415f, 0.575f);
            AddWeatherBar(ui, "MRAP_SVW", "clouds", "Clouds", s.SvClouds, "0.82 0.84 0.88 0.55", 0.245f, 0.405f);
            AddWeatherBar(ui, "MRAP_SVW", "wind",   "Wind",   s.SvWind,   "0.14 0.62 0.62 0.70", 0.075f, 0.235f);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        void SectionHeader(CuiElementContainer ui, string parent, string label) {
            // Colored left accent bar for section header
            ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0.025 0.880", AnchorMax = "0.040 0.978" } }, parent);
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.055 0.878", AnchorMax = "0.980 0.980" } }, parent);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.025 0.866", AnchorMax = "0.975 0.874" } }, parent);
        }

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
            float pad = (y1 - y0) * 0.14f;
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = string.Format("0.030 {0:F3}", y0), AnchorMax = string.Format("0.165 {0:F3}", y1) } }, par);
            string barId = par + "_b_" + key;
            ui.Add(new CuiPanel { Image = { Color = "0.048 0.060 0.080 1" }, RectTransform = { AnchorMin = string.Format("0.175 {0:F3}", y0 + pad), AnchorMax = string.Format("0.720 {0:F3}", y1 - pad) } }, par, barId);
            if (value > 0.005f) ui.Add(new CuiPanel { Image = { Color = fillClr }, RectTransform = { AnchorMin = "0 0", AnchorMax = string.Format("{0:F3} 1", value) } }, barId);
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}%", (int)(value * 100)), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CMuted }, RectTransform = { AnchorMin = string.Format("0.725 {0:F3}", y0), AnchorMax = string.Format("0.820 {0:F3}", y1) } }, par);
            float minus = Mathf.Max(0f, value - 0.1f);
            float plus  = Mathf.Min(1f, value + 0.1f);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, minus), Color = CCell }, RectTransform = { AnchorMin = string.Format("0.828 {0:F3}", y0 + pad), AnchorMax = string.Format("0.908 {0:F3}", y1 - pad) }, Text = { Text = "-", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = CText } }, par);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, plus),  Color = COrangeDeep }, RectTransform = { AnchorMin = string.Format("0.916 {0:F3}", y0 + pad), AnchorMax = string.Format("0.996 {0:F3}", y1 - pad) }, Text = { Text = "+", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = COrange } }, par);
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
