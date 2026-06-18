using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.9.7")]
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
        // ── Palette — matched to Carbon Admin Centre: flat grey + muted green ──
        private const string CBg         = "0.212 0.220 0.214 0.985";
        private const string CHeader     = "0.169 0.176 0.171 1";
        private const string CPanel      = "0.247 0.255 0.249 1";
        private const string CCell       = "0.149 0.157 0.152 1";   // inset value fields (darker)
        private const string CCellSel    = "0.200 0.330 0.180 1";
        private const string CDivider    = "1 1 1 0.05";
        // "Orange" names retained, but recolored to Carbon's muted green (primary accent)
        private const string COrange     = "0.34 0.56 0.27 1";
        private const string COrangeDim  = "0.34 0.56 0.27 0.16";
        private const string COrangeDeep = "0.18 0.28 0.15 1";
        private const string CBlue       = "0.34 0.56 0.86 1";
        private const string CBlueDim    = "0.34 0.56 0.86 0.15";
        private const string CBlueDeep   = "0.12 0.20 0.30 1";
        private const string CGreen      = "0.46 0.78 0.37 1";       // bright check/accent
        private const string CGreenDim   = "0.46 0.78 0.37 0.15";
        private const string CGreenDeep  = "0.18 0.28 0.15 1";
        private const string CRed        = "0.80 0.33 0.29 1";
        private const string CRedDim     = "0.80 0.33 0.29 0.16";
        private const string CRedDeep    = "0.26 0.13 0.12 1";
        private const string CText       = "0.92 0.93 0.92 1";
        private const string CMuted      = "0.64 0.67 0.64 1";
        private const string CDim        = "0.48 0.51 0.48 1";
        private const string CBtnOff     = "0.247 0.255 0.249 1";
        private const string CCooldown   = "0.55 0.40 0.12 1";

        private const string PluginVersion = "1.9.7";

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
        private static readonly int TotalItemCount;
        static MyRconAdminPanel() {
            AllCats = new List<string> { "All" };
            AllCats.AddRange(Categories.Keys);
            TotalItemCount = Categories.Values.SelectMany(x => x).Count();
        }

        // ── Per-player state ──────────────────────────────────────────────────
        private class S
        {
            public string   Screen       = ScrHome;
            public string   Cat          = "All";
            public int      GivePage     = 0;
            public string   SearchQuery  = "";
            public string   Item         = null;
            public string   ItemName     = null;
            public int      Stack        = 1;
            public ulong    GiveTarget   = 0;
            public string   Amt          = "100";
            public int      Custom       = 100;
            public DateTime LastGiveAt   = DateTime.MinValue;
            public int      PlayerPage   = 0;
            public ulong    PlayerSel    = 0;
            public string   PlayerSearch = "";
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
            var s = Get(p); s.Screen = ScrPlayers;
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
            if (s.Screen == ScrGive)    { s.Item = null; s.GiveTarget = 0; s.SearchQuery = ""; }
            if (s.Screen == ScrPlayers) { s.PlayerSel = 0; s.PlayerPage = 0; }
            Draw(p, force: true);
        }

        [ConsoleCommand("mrap.cat")]
        void CmdCat(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); s.Cat = a.GetString(0); s.GivePage = 0; s.Item = null; s.GiveTarget = 0; s.SearchQuery = "";
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.page")]
        void CmdPage(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).GivePage = a.GetInt(0); Draw(p, force: true);
        }
        [ConsoleCommand("mrap.item")]
        void CmdItem(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var sn = a.GetString(0); var def = ItemManager.FindItemDefinition(sn); if (def == null) return;
            var s = Get(p); s.Item = sn; s.ItemName = def.displayName.translated; s.Stack = def.stackable; s.GiveTarget = 0;
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.target")]
        void CmdTarget(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var id = a.GetUInt64(0); s.GiveTarget = s.GiveTarget == id ? 0UL : id;
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.amt")]
        void CmdAmt(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).Amt = a.GetString(0); Draw(p, force: true);
        }
        [ConsoleCommand("mrap.custom")]
        void CmdCustom(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            if (int.TryParse(a.GetString(0), out int n) && n > 0) Get(p).Custom = Math.Min(n, 100000);
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.search")]
        void CmdSearch(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null) return;
            var s = Get(p);
            s.SearchQuery = a.HasArgs() ? a.GetString(0).ToLower().Trim() : "";
            s.GivePage = 0;
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.clearsearch")]
        void CmdClearSearch(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null) return;
            var s = Get(p); s.SearchQuery = ""; s.GivePage = 0;
            Draw(p, force: true);
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
            Puts(string.Format("[AdminPanel] {0} gave {1}x {2} -> {3}", p.displayName, amt, s.Item, tgt.displayName));
            SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Gave <color=#fff>{0}x</color> <color=#F06A0F>{1}</color> to <color=#fff>{2}</color>.", amt.ToString("N0"), s.ItemName, tgt.displayName));
            s.GiveTarget = 0; Draw(p, force: true);
        }

        [ConsoleCommand("mrap.ppage")]
        void CmdPPage(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).PlayerPage = a.GetInt(0); Draw(p, force: true);
        }
        [ConsoleCommand("mrap.psearch")]
        void CmdPSearch(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null) return;
            var s = Get(p);
            s.PlayerSearch = a.HasArgs() ? string.Join(" ", a.Args) : "";
            s.PlayerPage = 0;
            Draw(p, force: true);
        }
        [ConsoleCommand("mrap.psel")]
        void CmdPSel(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var id = a.GetUInt64(0);
            s.PlayerSel = s.PlayerSel == id ? 0UL : id;
            Draw(p, force: true);  // force: selection must update immediately
        }
        [ConsoleCommand("mrap.paction")]
        void CmdPAction(ConsoleSystem.Arg a) {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var action = a.GetString(0);
            if (s.PlayerSel == 0) return;
            var tgt = BasePlayer.FindByID(s.PlayerSel);
            // Guard self against destructive / pointless actions
            if (tgt != null && tgt.userID == p.userID && (action == "kick" || action == "ban" || action == "teleport_to" || action == "teleport_here")) {
                SendReply(p, "<color=#F06A0F>MyRcon</color>: You can't do that to yourself.");
                return;
            }
            switch (action) {
                case "teleport_to":
                    if (tgt != null) { p.Teleport(tgt.transform.position); SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Teleported to {0}.", tgt.displayName)); }
                    break;
                case "teleport_here":
                    if (tgt != null) { tgt.Teleport(p.transform.position); SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Teleported {0} to you.", tgt.displayName)); }
                    break;
                case "heal":
                    if (tgt != null) {
                        tgt.health = tgt.MaxHealth();
                        tgt.metabolism.hydration.value  = tgt.metabolism.hydration.max;
                        tgt.metabolism.calories.value   = tgt.metabolism.calories.max;
                        tgt.metabolism.bleeding.value   = 0f;
                        tgt.metabolism.radiation_poison.value = 0f;
                        tgt.metabolism.SendChangesToClient();
                        SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Healed {0}.", tgt.displayName));
                    }
                    break;
                case "kill":
                    if (tgt != null) {
                        string kname = tgt.displayName;
                        tgt.Kill();
                        s.PlayerSel = 0;
                        Puts(string.Format("[AdminPanel] {0} killed {1}", p.displayName, kname));
                        SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Killed {0}.", kname));
                    }
                    break;
                case "strip":
                    if (tgt != null) {
                        tgt.inventory.Strip();
                        Puts(string.Format("[AdminPanel] {0} stripped inventory of {1}", p.displayName, tgt.displayName));
                        SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Stripped inventory of {0}.", tgt.displayName));
                    }
                    break;
                case "kick":
                    if (tgt != null) {
                        string kk = tgt.displayName;
                        tgt.Kick("Kicked by admin");
                        s.PlayerSel = 0;
                        Puts(string.Format("[AdminPanel] {0} kicked {1}", p.displayName, kk));
                        SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Kicked {0}.", kk));
                    }
                    break;
                case "ban":
                    if (tgt != null) {
                        string bn = tgt.displayName; ulong uid = tgt.userID;
                        ServerUsers.Set(uid, ServerUsers.UserGroup.Banned, bn, string.Format("Banned by {0}", p.displayName));
                        ServerUsers.Save();
                        tgt.Kick("Banned by admin");
                        s.PlayerSel = 0;
                        Puts(string.Format("[AdminPanel] {0} banned {1} ({2})", p.displayName, bn, uid));
                        SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Banned {0}.", bn));
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
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.rain",   "0");
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "weather.fog",    "0");
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
                    SendReply(p, string.Format("<color=#F06A0F>MyRcon</color>: Healed all {0} players.", BasePlayer.activePlayerList.Count));
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
            float val  = Mathf.Clamp01(a.GetFloat(1));
            string key = a.GetString(0);
            string cvar = null;
            switch (key) {
                case "rain":   s.SvRain   = val; cvar = "weather.rain";   break;
                case "fog":    s.SvFog    = val; cvar = "weather.fog";    break;
                case "clouds": s.SvClouds = val; cvar = "weather.clouds"; break;
                case "wind":   s.SvWind   = val; cvar = "weather.wind";   break;
            }
            if (cvar != null) ConsoleSystem.Run(ConsoleSystem.Option.Server, cvar, val.ToString("F2"));
            Draw(p, force: true);
        }

        // ── Master draw ───────────────────────────────────────────────────────

        void Draw(BasePlayer player, bool force = false) {
            var s = Get(player);
            if (!force && !AllowDraw(s)) return;

            CuiHelper.DestroyUi(player, UiShadow);
            CuiHelper.DestroyUi(player, UiMain);
            var ui = new CuiElementContainer();

            // Thin accent glow border behind modal
            ui.Add(new CuiPanel {
                Image         = { Color = "0.38 0.64 0.33 0.22" },
                RectTransform = { AnchorMin = "0.1490 0.0790", AnchorMax = "0.8510 0.9310" },
                CursorEnabled = false
            }, "Overlay", UiShadow);

            // Main modal panel
            ui.Add(new CuiPanel {
                Image           = { Color = CBg },
                RectTransform   = { AnchorMin = "0.15 0.08", AnchorMax = "0.85 0.93" },
                CursorEnabled   = true,
                KeyboardEnabled = false
            }, "Overlay", UiMain);

            DrawHeader(ui, s);

            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.942" }
            }, UiMain, UiBody);

            switch (s.Screen) {
                case ScrGive:    DrawGiveScreen(ui, s, player); break;
                case ScrServer:  DrawServerScreen(ui, s);       break;
                default:         DrawPlayersScreen(ui, s, player); break;
            }

            CuiHelper.AddUi(player, ui);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  HEADER
        // ═══════════════════════════════════════════════════════════════════════

        void DrawHeader(CuiElementContainer ui, S s) {
            ui.Add(new CuiPanel {
                Image         = { Color = CHeader },
                RectTransform = { AnchorMin = "0 0.945", AnchorMax = "1 1" }
            }, UiMain, "MRAP_H");

            // Subtle bottom divider under the header (Carbon-style, not a bold bar)
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.030" } }, "MRAP_H");

            // Logo image
            ui.Add(new CuiElement {
                Name   = "MRAP_Logo",
                Parent = "MRAP_H",
                Components = {
                    new CuiRawImageComponent { Url = "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/public/logo.png", Color = "1 1 1 1" },
                    new CuiRectTransformComponent { AnchorMin = "0.004 0.060", AnchorMax = "0.090 0.940" }
                }
            });

            // Tab bar — full-width, Carbon Admin Centre style
            string[] tabScreens = { ScrPlayers, ScrGive, ScrServer };
            string[] tabLabels  = { "Players",  "Give Items", "Server" };
            const float tabStart = 0.095f; const float tabEnd = 0.840f; const float tg = 0.006f;
            float tw = (tabEnd - tabStart) / tabScreens.Length;
            for (int t = 0; t < tabScreens.Length; t++) {
                bool active = s.Screen == tabScreens[t] || (s.Screen == ScrHome && tabScreens[t] == ScrPlayers);
                float x0 = tabStart + t * tw;
                string tn = "MRAP_TAB" + t;
                // Carbon style: active tab is a solid green fill, inactive is bare.
                ui.Add(new CuiPanel {
                    Image         = { Color = active ? COrange : "0 0 0 0" },
                    RectTransform = { AnchorMin = string.Format("{0:F4} 0.04", x0), AnchorMax = string.Format("{0:F4} 0.96", x0 + tw - tg) }
                }, "MRAP_H", tn);
                ui.Add(new CuiButton {
                    Button        = { Command = "mrap.nav " + tabScreens[t], Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                    Text          = { Text = tabLabels[t], FontSize = 12, Align = TextAnchor.MiddleCenter, Color = active ? "1 1 1 1" : CMuted, Font = "robotocondensed-bold.ttf" }
                }, tn);
            }

            // Online indicator (compact)
            int online = BasePlayer.activePlayerList.Count;
            string onClr = online > 0 ? CGreen : CDim;
            ui.Add(new CuiPanel { Image = { Color = online > 0 ? "0.04 0.15 0.08 1" : "0.08 0.10 0.13 1" }, RectTransform = { AnchorMin = "0.847 0.20", AnchorMax = "0.933 0.80" } }, "MRAP_H", "MRAP_OB");
            ui.Add(new CuiLabel {
                Text          = { Text = string.Format("{0} online", online), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = onClr, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
            }, "MRAP_OB");

            // Close button
            ui.Add(new CuiButton {
                Button        = { Command = "mrap.close", Color = "0.44 0.06 0.04 1" },
                RectTransform = { AnchorMin = "0.937 0.13", AnchorMax = "0.998 0.87" },
                Text          = { Text = "X", FontSize = 12, Align = TextAnchor.MiddleCenter, Color = "1 0.50 0.44 1", Font = "robotocondensed-bold.ttf" }
            }, "MRAP_H");
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  HOME SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private struct Tile {
            public string Screen, Title, Desc, IconItem, Stat1, Stat2;
            public string Accent, AccentDim, AccentDeep;
        }

        void DrawHome(CuiElementContainer ui, S s) {
            int online   = BasePlayer.activePlayerList.Count;
            int sleeping = BasePlayer.sleepingPlayerList.Count;
            int fps      = (int)Performance.current.frameRate;
            int entities = BaseNetworkable.serverEntities.Count;
            int admins   = BasePlayer.activePlayerList.Count(p => p.IsAdmin);

            float uptimeSec = UnityEngine.Time.realtimeSinceStartup;
            int uh = (int)(uptimeSec / 3600f);
            int um = (int)((uptimeSec % 3600f) / 60f);
            string uptime = uh > 0 ? string.Format("{0}h {1}m", uh, um) : string.Format("{0}m", um);

            var tiles = new Tile[] {
                new Tile {
                    Screen = ScrGive, Title = "Give Items", IconItem = "rifle.ak",
                    Desc   = "Give items & kits to online players",
                    Stat1  = string.Format("{0} items available", TotalItemCount),
                    Stat2  = string.Format("{0} categories", Categories.Count),
                    Accent = COrange, AccentDim = COrangeDim, AccentDeep = COrangeDeep
                },
                new Tile {
                    Screen = ScrPlayers, Title = "Players", IconItem = "metal.facemask",
                    Desc   = "Manage, teleport, heal, kick & ban",
                    Stat1  = string.Format("{0} online  {1} sleeping", online, sleeping),
                    Stat2  = admins > 0 ? string.Format("{0} admin(s) online", admins) : "No admins online",
                    Accent = CBlue, AccentDim = CBlueDim, AccentDeep = CBlueDeep
                },
                new Tile {
                    Screen = ScrServer, Title = "Server", IconItem = "hammer",
                    Desc   = "Commands, weather & maintenance",
                    Stat1  = string.Format("{0} fps  {1} entities", fps, entities),
                    Stat2  = string.Format("Up {0}", uptime),
                    Accent = CGreen, AccentDim = CGreenDim, AccentDeep = CGreenDeep
                },
                new Tile {
                    Screen = "", Title = "Coming Soon", IconItem = "lock.code",
                    Desc   = "More modules being added",
                    Stat1  = "", Stat2  = "",
                    Accent = CDim, AccentDim = "0 0 0 0", AccentDeep = "0.050 0.060 0.078 1"
                }
            };

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

            for (int i = 0; i < tiles.Length; i++) {
                var t      = tiles[i];
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

                // Top colored section — icon lives here
                string topBg = future ? "0.050 0.060 0.078 1" : t.AccentDeep;
                ui.Add(new CuiPanel {
                    Image         = { Color = topBg },
                    RectTransform = { AnchorMin = "0 0.460", AnchorMax = "1 1" }
                }, tn, string.Format("{0}_T", tn));

                // Very subtle top-edge highlight
                ui.Add(new CuiPanel { Image = { Color = "1 1 1 0.025" }, RectTransform = { AnchorMin = "0 0.94", AnchorMax = "1 1" } }, string.Format("{0}_T", tn));

                // Item icon — centered in top section
                var iconDef = ItemManager.FindItemDefinition(t.IconItem);
                if (iconDef != null) {
                    ui.Add(new CuiElement {
                        Parent = string.Format("{0}_T", tn),
                        Components = {
                            new CuiImageComponent { ItemId = iconDef.itemid, SkinId = 0 },
                            new CuiRectTransformComponent { AnchorMin = "0.32 0.10", AnchorMax = "0.68 0.90" }
                        }
                    });
                }

                // Accent separator bar
                ui.Add(new CuiPanel {
                    Image         = { Color = future ? "1 1 1 0.040" : t.Accent },
                    RectTransform = { AnchorMin = "0 0.452", AnchorMax = "1 0.462" }
                }, tn);

                // Bottom section — title + stats + CTA
                ui.Add(new CuiLabel {
                    Text          = { Text = t.Title, FontSize = 15, Align = TextAnchor.UpperLeft, Color = future ? CDim : CText, Font = "robotocondensed-bold.ttf" },
                    RectTransform = { AnchorMin = "0.072 0.300", AnchorMax = "0.965 0.440" }
                }, tn);

                if (t.Stat1.Length > 0) {
                    ui.Add(new CuiLabel {
                        Text          = { Text = t.Stat1, FontSize = 9, Align = TextAnchor.UpperLeft, Color = future ? CDim : CMuted, Font = "robotocondensed-regular.ttf" },
                        RectTransform = { AnchorMin = "0.072 0.200", AnchorMax = "0.965 0.300" }
                    }, tn);
                }
                if (t.Stat2.Length > 0) {
                    ui.Add(new CuiLabel {
                        Text          = { Text = t.Stat2, FontSize = 9, Align = TextAnchor.UpperLeft, Color = future ? "0.28 0.32 0.38 1" : CDim, Font = "robotocondensed-regular.ttf" },
                        RectTransform = { AnchorMin = "0.072 0.110", AnchorMax = "0.965 0.200" }
                    }, tn);
                }

                if (!future) {
                    ui.Add(new CuiLabel {
                        Text          = { Text = "Open  >", FontSize = 10, Align = TextAnchor.MiddleRight, Color = t.Accent, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.55 0.018", AnchorMax = "0.965 0.108" }
                    }, tn);
                    ui.Add(new CuiButton {
                        Button        = { Command = string.Format("mrap.nav {0}", t.Screen), Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                        Text          = { Text = "" }
                    }, tn);
                } else {
                    ui.Add(new CuiPanel {
                        Image         = { Color = CCell },
                        RectTransform = { AnchorMin = "0.072 0.030", AnchorMax = "0.400 0.108" }
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
            bool hasSearch = !string.IsNullOrEmpty(s.SearchQuery);

            // Search bar
            string srchN = "MRAP_SR";
            ui.Add(new CuiPanel {
                Image         = { Color = CCell },
                RectTransform = { AnchorMin = "0 0.942", AnchorMax = string.Format("{0:F3} 0.978", xRight) }
            }, UiBody, srchN);
            // Left accent
            ui.Add(new CuiPanel { Image = { Color = hasSearch ? COrange : CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.010 1" } }, srchN);
            // Search label
            ui.Add(new CuiLabel {
                Text          = { Text = hasSearch ? "" : "Search items... (press Enter)", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.018 0", AnchorMax = "0.75 1" }
            }, srchN);
            // Input field overlaid
            ui.Add(new CuiElement {
                Name   = "MRAP_SRInput",
                Parent = srchN,
                Components = {
                    new CuiInputFieldComponent { Text = s.SearchQuery, FontSize = 10, Align = TextAnchor.MiddleLeft, Command = "mrap.search", Color = CText, CharsLimit = 32 },
                    new CuiRectTransformComponent { AnchorMin = "0.018 0", AnchorMax = "0.750 1" }
                }
            });
            // Result count or clear button
            if (hasSearch) {
                var filtered = FilteredItems(s.Cat, s.SearchQuery);
                ui.Add(new CuiLabel { Text = { Text = string.Format("{0} results", filtered.Count), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.750 0", AnchorMax = "0.870 1" } }, srchN);
                ui.Add(new CuiButton { Button = { Command = "mrap.clearsearch", Color = "0.14 0.05 0.02 1" }, RectTransform = { AnchorMin = "0.875 0.12", AnchorMax = "0.995 0.88" }, Text = { Text = "Clear", FontSize = 9, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" } }, srchN);
            } else {
                var all = ItemsFor(s.Cat);
                ui.Add(new CuiLabel { Text = { Text = string.Format("{0} items", all.Count), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.750 0", AnchorMax = "0.995 1" } }, srchN);
            }

            // Category tabs
            string tabsN = "MRAP_Tabs";
            ui.Add(new CuiPanel {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0.898", AnchorMax = string.Format("{0:F3} 0.938", xRight) }
            }, UiBody, tabsN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.055" } }, tabsN);

            float tabW = 1f / AllCats.Count;
            for (int i = 0; i < AllCats.Count; i++) {
                string cat = AllCats[i]; bool active = s.Cat == cat && !hasSearch;
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
                RectTransform = { AnchorMin = "0 0.050", AnchorMax = string.Format("{0:F3} 0.895", xRight) }
            }, UiBody, gridN);

            var items = FilteredItems(s.Cat, s.SearchQuery);
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

            if (page.Count == 0) {
                ui.Add(new CuiLabel { Text = { Text = hasSearch ? string.Format("No items matching \"{0}\"", s.SearchQuery) : "No items in this category", FontSize = 12, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.1 0.35", AnchorMax = "0.9 0.65" } }, gridN);
            }

            // Pagination bar
            string pageInfo = hasSearch
                ? string.Format("Search: \"{0}\"  -  {1} results  -  page {2}/{3}", s.SearchQuery, items.Count, s.GivePage + 1, pages)
                : string.Format("{0}  -  {1} items  -  page {2}/{3}", s.Cat, items.Count, s.GivePage + 1, pages);
            ui.Add(new CuiLabel { Text = { Text = pageInfo, FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.01 0.005", AnchorMax = "0.55 0.075" } }, gridN);
            if (s.GivePage > 0)         ui.Add(new CuiButton { Button = { Command = string.Format("mrap.page {0}", s.GivePage - 1), Color = CCell }, RectTransform = { AnchorMin = "0.57 0.008", AnchorMax = "0.77 0.078" }, Text = { Text = "< Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);
            if (s.GivePage < pages - 1) ui.Add(new CuiButton { Button = { Command = string.Format("mrap.page {0}", s.GivePage + 1), Color = CCell }, RectTransform = { AnchorMin = "0.79 0.008", AnchorMax = "0.998 0.078" }, Text = { Text = "Next >", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, gridN);

            if (s.Item != null) DrawGivePanel(ui, s, invoker, GiveCooldownLeft(s));
        }

        void DrawGivePanel(CuiElementContainer ui, S s, BasePlayer invoker, double cd) {
            string gp = "MRAP_GP";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.66 0", AnchorMax = "1 0.942" } }, UiBody, gp);
            ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0 0.01", AnchorMax = "0.006 0.99" } }, gp);

            // Item header
            ui.Add(new CuiPanel { Image = { Color = "0.046 0.056 0.074 1" }, RectTransform = { AnchorMin = "0.025 0.900", AnchorMax = "0.975 0.990" } }, gp, "MRAP_GH");
            ui.Add(new CuiPanel { Image = { Color = COrange }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.018 1" } }, "MRAP_GH");
            var hdef = ItemManager.FindItemDefinition(s.Item);
            if (hdef != null) ui.Add(new CuiElement { Parent = "MRAP_GH", Components = { new CuiImageComponent { ItemId = hdef.itemid, SkinId = 0 }, new CuiRectTransformComponent { AnchorMin = "0.06 0.10", AnchorMax = "0.24 0.90" } } });
            ui.Add(new CuiLabel { Text = { Text = s.ItemName ?? s.Item, FontSize = 12, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.28 0.48", AnchorMax = "0.98 0.94" } }, "MRAP_GH");
            ui.Add(new CuiLabel { Text = { Text = s.Item, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.28 0.06", AnchorMax = "0.98 0.50" } }, "MRAP_GH");

            ui.Add(new CuiLabel { Text = { Text = "GIVE TO", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.853", AnchorMax = "0.95 0.893" } }, gp);

            var players = BasePlayer.activePlayerList.OrderBy(p => p.userID != invoker.userID).ThenBy(p => p.displayName).ToList();
            const float rH = 0.058f; const float rGap = 0.005f; float rTop = 0.850f; const int maxR = 8;
            for (int i = 0; i < Math.Min(players.Count, maxR); i++) {
                var pl = players[i]; bool inv = pl.userID == invoker.userID; bool sel = s.GiveTarget == pl.userID;
                float yMx = rTop - i * (rH + rGap); float yMn = yMx - rH; string rn = string.Format("MRAP_PR{0}", i);
                ui.Add(new CuiPanel { Image = { Color = sel ? "0.16 0.09 0.02 1" : "0.074 0.090 0.116 1" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", yMn), AnchorMax = string.Format("0.96 {0:F3}", yMx) } }, gp, rn);
                ui.Add(new CuiPanel { Image = { Color = sel ? COrange : CDivider }, RectTransform = { AnchorMin = "0 0.12", AnchorMax = "0.014 0.88" } }, rn);
                ui.Add(new CuiLabel { Text = { Text = pl.displayName, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = sel ? "1 0.84 0.64 1" : CText, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.06 0", AnchorMax = inv ? "0.70 1" : "0.97 1" } }, rn);
                if (inv) {
                    ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0.72 0.18", AnchorMax = "0.98 0.82" } }, rn);
                    ui.Add(new CuiLabel { Text = { Text = "YOU", FontSize = 7, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.72 0.18", AnchorMax = "0.98 0.82" } }, rn);
                }
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.target {0}", pl.userID), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }
            if (players.Count > maxR) ui.Add(new CuiLabel { Text = { Text = string.Format("+{0} more online", players.Count - maxR), FontSize = 8, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0.04 0.375", AnchorMax = "0.96 0.415" } }, gp);

            ui.Add(new CuiLabel { Text = { Text = "AMOUNT", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.337", AnchorMax = "0.95 0.374" } }, gp);
            var modes = new (string m, string l)[] { ("100","100"), ("1000","1,000"), ("stack", string.Format("Stack ({0})", s.Stack)), ("custom","Custom") };
            const float bH2 = 0.062f; const float bGap = 0.010f; float bTop = 0.334f;
            for (int i = 0; i < 4; i++) {
                var (m, l) = modes[i]; bool on = s.Amt == m;
                int col = i % 2; int row2 = i / 2;
                float xMn = 0.04f + col * (0.475f + bGap); float yMx = bTop - row2 * (bH2 + bGap); float yMn2 = yMx - bH2;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.amt {0}", m), Color = on ? COrangeDim : "0.080 0.098 0.128 1" }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", xMn, yMn2), AnchorMax = string.Format("{0:F3} {1:F3}", xMn + 0.475f, yMx) }, Text = { Text = l, FontSize = 10, Align = TextAnchor.MiddleCenter, Color = on ? "1 0.84 0.64 1" : CMuted, Font = "robotocondensed-regular.ttf" } }, gp);
            }

            float baseY = bTop - 2 * (bH2 + bGap);
            if (s.Amt == "custom") {
                ui.Add(new CuiPanel { Image = { Color = "0.080 0.098 0.128 1" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", baseY - 0.072f), AnchorMax = string.Format("0.96 {0:F3}", baseY) } }, gp, "MRAP_In");
                ui.Add(new CuiElement { Name = "MRAP_InF", Parent = "MRAP_In", Components = {
                    new CuiInputFieldComponent { Text = s.Custom.ToString(), FontSize = 13, Align = TextAnchor.MiddleCenter, Command = "mrap.custom", Color = CText, CharsLimit = 6 },
                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                }});
                baseY -= 0.080f;
            }

            int res = Resolve(s);
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}x  {1}", res.ToString("N0"), s.ItemName ?? s.Item), FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = string.Format("0.04 {0:F3}", baseY - 0.040f), AnchorMax = string.Format("0.96 {0:F3}", baseY) } }, gp);

            bool can = s.GiveTarget != 0; bool onCd = cd > 0;
            string btnCmd   = (can && !onCd) ? "mrap.give" : "";
            string btnColor = onCd ? CCooldown : (can ? COrange : "0.080 0.098 0.128 1");
            string btnLabel = onCd ? string.Format("Wait  {0:F1}s...", cd) : can ? string.Format("Give  {0}x", res.ToString("N0")) : "Select a player above";
            ui.Add(new CuiButton { Button = { Command = btnCmd, Color = btnColor }, RectTransform = { AnchorMin = "0.04 0.022", AnchorMax = "0.96 0.100" }, Text = { Text = btnLabel, FontSize = 12, Align = TextAnchor.MiddleCenter, Color = (can && !onCd) ? "1 1 1 1" : CDim, Font = "robotocondensed-bold.ttf" } }, gp);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  PLAYERS SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        private const int PlayersPerPage = 12;

        void DrawPlayersScreen(CuiElementContainer ui, S s, BasePlayer invoker) {
            string q = (s.PlayerSearch ?? "").Trim().ToLower();
            System.Func<BasePlayer, bool> match = pl =>
                q.Length == 0 || (pl.displayName ?? "").ToLower().Contains(q) || pl.UserIDString.Contains(q);

            var online   = BasePlayer.activePlayerList.Where(match).OrderBy(p => p.displayName).ToList();
            var sleepers = BasePlayer.sleepingPlayerList.Where(match).OrderBy(p => p.displayName).ToList();

            int pages       = Math.Max(1, (int)Math.Ceiling(online.Count / (float)PlayersPerPage));
            s.PlayerPage    = Mathf.Clamp(s.PlayerPage, 0, pages - 1);
            var pagePlayers = online.Skip(s.PlayerPage * PlayersPerPage).Take(PlayersPerPage).ToList();

            // Left column: search + online/offline lists
            string listN = "MRAP_PL";
            ui.Add(new CuiPanel { Image = { Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0.045", AnchorMax = "0.572 0.975" } }, UiBody, listN);

            ui.Add(new CuiLabel { Text = { Text = "Search:", FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.022 0.952", AnchorMax = "0.22 0.992" } }, listN);
            ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = "0.225 0.950", AnchorMax = "0.980 0.992" } }, listN, "MRAP_PSB");
            ui.Add(new CuiElement {
                Name = "MRAP_PSF", Parent = "MRAP_PSB",
                Components = {
                    new CuiInputFieldComponent { Text = s.PlayerSearch ?? "", FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CText, Command = "mrap.psearch", CharsLimit = 32 },
                    new CuiRectTransformComponent { AnchorMin = "0.02 0", AnchorMax = "0.98 1" }
                }
            });

            ui.Add(new CuiLabel { Text = { Text = string.Format("ONLINE ({0})", online.Count), FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.022 0.905", AnchorMax = "0.980 0.942" } }, listN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0 0.900", AnchorMax = "1 0.903" } }, listN);

            const float rH = 0.058f; const float rG = 0.006f;
            float topY = 0.892f;
            for (int i = 0; i < pagePlayers.Count; i++) {
                var pl   = pagePlayers[i];
                bool sel = s.PlayerSel == pl.userID;
                bool self = pl.userID == invoker.userID;
                float y1 = topY - i * (rH + rG);
                float y0 = y1 - rH;
                string rn = "MRAP_PLR" + i;
                ui.Add(new CuiPanel { Image = { Color = sel ? COrange : CCell }, RectTransform = { AnchorMin = string.Format("0 {0:F3}", y0), AnchorMax = string.Format("1 {0:F3}", y1) } }, listN, rn);
                ui.Add(new CuiLabel { Text = { Text = pl.displayName + (self ? "  (you)" : ""), FontSize = 12, Align = TextAnchor.MiddleCenter, Color = sel ? "1 1 1 1" : CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.04 0", AnchorMax = "0.80 1" } }, rn);
                int ping = Network.Net.sv.GetAveragePing(pl.Connection);
                string pingClr = sel ? "1 1 1 1" : ping < 80 ? CGreen : ping < 150 ? "0.92 0.78 0.22 1" : CRed;
                ui.Add(new CuiLabel { Text = { Text = ping + "ms", FontSize = 10, Align = TextAnchor.MiddleRight, Color = pingClr, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.80 0", AnchorMax = "0.965 1" } }, rn);
                ui.Add(new CuiButton { Button = { Command = "mrap.psel " + pl.userID, Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, rn);
            }
            if (online.Count == 0)
                ui.Add(new CuiLabel { Text = { Text = "No players online", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = CDim }, RectTransform = { AnchorMin = "0 0.84", AnchorMax = "1 0.89" } }, listN);

            float offY = topY - pagePlayers.Count * (rH + rG) - 0.018f;
            if (offY < 0.075f) offY = 0.075f;
            ui.Add(new CuiLabel { Text = { Text = string.Format("OFFLINE ({0})", sleepers.Count), FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = string.Format("0.022 {0:F3}", offY), AnchorMax = string.Format("0.980 {0:F3}", offY + 0.037f) } }, listN);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = string.Format("0 {0:F3}", offY - 0.004f), AnchorMax = string.Format("1 {0:F3}", offY - 0.001f) } }, listN);
            if (sleepers.Count == 0) {
                ui.Add(new CuiLabel { Text = { Text = "No offline players found", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = string.Format("0 {0:F3}", offY - 0.05f), AnchorMax = string.Format("1 {0:F3}", offY - 0.01f) } }, listN);
            } else {
                int show = Math.Min(sleepers.Count, 6);
                for (int i = 0; i < show; i++) {
                    float yy1 = (offY - 0.012f) - i * (rH + rG);
                    float yy0 = yy1 - rH;
                    if (yy0 < 0.045f) break;
                    string rn = "MRAP_OFF" + i;
                    ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = string.Format("0 {0:F3}", yy0), AnchorMax = string.Format("1 {0:F3}", yy1) } }, listN, rn);
                    ui.Add(new CuiLabel { Text = { Text = sleepers[i].displayName, FontSize = 11, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.04 0", AnchorMax = "0.96 1" } }, rn);
                }
            }

            if (pages > 1) {
                ui.Add(new CuiLabel { Text = { Text = string.Format("Page {0} / {1}", s.PlayerPage + 1, pages), FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim }, RectTransform = { AnchorMin = "0.022 0.004", AnchorMax = "0.480 0.040" } }, listN);
                if (s.PlayerPage > 0)        ui.Add(new CuiButton { Button = { Command = "mrap.ppage " + (s.PlayerPage - 1), Color = CCell }, RectTransform = { AnchorMin = "0.500 0.004", AnchorMax = "0.730 0.040" }, Text = { Text = "<  Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);
                if (s.PlayerPage < pages-1)  ui.Add(new CuiButton { Button = { Command = "mrap.ppage " + (s.PlayerPage + 1), Color = CCell }, RectTransform = { AnchorMin = "0.755 0.004", AnchorMax = "0.985 0.040" }, Text = { Text = "Next  >", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, listN);
            }

            // Right column: player information + actions
            string actN = "MRAP_PA";
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.592 0", AnchorMax = "1 0.975" } }, UiBody, actN);

            var sel2 = s.PlayerSel != 0 ? BasePlayer.FindByID(s.PlayerSel) : null;
            if (sel2 == null) {
                ui.Add(new CuiLabel { Text = { Text = "Select a player", FontSize = 14, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.05 0.50", AnchorMax = "0.95 0.56" } }, actN);
                ui.Add(new CuiLabel { Text = { Text = "from the list on the left", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CDim, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.05 0.44", AnchorMax = "0.95 0.50" } }, actN);
                return;
            }

            float y = 0.965f;
            PaSection(ui, actN, "PLAYER INFORMATION", ref y);
            PaRow(ui, actN, "Name",     sel2.displayName,    ref y);
            PaRow(ui, actN, "Steam ID", sel2.UserIDString,   ref y);
            PaRow(ui, actN, "Net ID",   sel2.net != null ? sel2.net.ID.Value.ToString() : "-", ref y);
            var pos = sel2.transform.position;
            PaRow(ui, actN, "Position", string.Format("{0:F0}, {1:F0}, {2:F0}", pos.x, pos.y, pos.z), ref y);
            int hp = (int)(sel2.health / sel2.MaxHealth() * 100f);
            PaRow(ui, actN, "Health",   hp + "%", ref y);

            bool isAdmin = sel2.IsAdmin;
            bool isMod   = ServerUsers.Is(sel2.userID, ServerUsers.UserGroup.Moderator);
            PaRow(ui, actN, "Auth", isAdmin ? "Admin" : isMod ? "Moderator" : "Player", ref y);

            y -= 0.012f;
            PaSection(ui, actN, "ACTIONS", ref y);

            bool isSelf = sel2.userID == invoker.userID;
            string[] aCmds   = { "teleport_to", "teleport_here", "heal", "strip", "kill", "kick", "ban" };
            string[] aLabels = { "Teleport To", "Bring Here",    "Heal", "Strip", "Kill", "Kick", "Ban" };
            bool[]   aDanger = { false,          false,           false,  false,   true,   true,   true };

            const float bW = 0.300f; const float bGX = 0.0235f; const float bGY = 0.012f; const float bH = 0.055f;
            float gridTop = y;
            for (int i = 0; i < aCmds.Length; i++) {
                int col = i % 3; int row = i / 3;
                float x0 = 0.028f + col * (bW + bGX);
                float ay1 = gridTop - row * (bH + bGY);
                float ay0 = ay1 - bH;
                string an = "MRAP_ACT" + i;
                bool selfBlocked = isSelf && (aCmds[i] == "teleport_to" || aCmds[i] == "teleport_here" || aCmds[i] == "kick" || aCmds[i] == "ban");
                string bg  = selfBlocked ? CBtnOff : aDanger[i] ? CRedDeep : CCell;
                string txt = selfBlocked ? CDim    : aDanger[i] ? CRed     : CText;
                ui.Add(new CuiPanel { Image = { Color = bg }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", x0, ay0), AnchorMax = string.Format("{0:F3} {1:F3}", x0 + bW, ay1) } }, actN, an);
                ui.Add(new CuiLabel { Text = { Text = aLabels[i], FontSize = 11, Align = TextAnchor.MiddleCenter, Color = txt, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" } }, an);
                if (!selfBlocked) ui.Add(new CuiButton { Button = { Command = "mrap.paction " + aCmds[i], Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, an);
            }
        }

        // Section header for the player info panel (label + divider), advances y down.
        void PaSection(CuiElementContainer ui, string parent, string text, ref float y) {
            ui.Add(new CuiLabel { Text = { Text = text, FontSize = 10, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = string.Format("0.028 {0:F3}", y - 0.030f), AnchorMax = string.Format("0.972 {0:F3}", y) } }, parent);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = string.Format("0.028 {0:F3}", y - 0.034f), AnchorMax = string.Format("0.972 {0:F3}", y - 0.031f) } }, parent);
            y -= 0.046f;
        }

        // Label + value-box row for the player info panel, advances y down.
        void PaRow(CuiElementContainer ui, string parent, string label, string value, ref float y) {
            const float h = 0.044f;
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = string.Format("0.028 {0:F3}", y - h), AnchorMax = string.Format("0.40 {0:F3}", y) } }, parent);
            string vn = "MRAP_V_" + label.Replace(" ", "");
            ui.Add(new CuiPanel { Image = { Color = CCell }, RectTransform = { AnchorMin = string.Format("0.40 {0:F3}", y - h + 0.004f), AnchorMax = string.Format("0.972 {0:F3}", y - 0.003f) } }, parent, vn);
            ui.Add(new CuiLabel { Text = { Text = value, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = "0.04 0", AnchorMax = "0.97 1" } }, vn);
            y -= (h + 0.008f);
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  SERVER SCREEN
        // ═══════════════════════════════════════════════════════════════════════

        void DrawServerScreen(CuiElementContainer ui, S s) {
            // ── Server status strip (top, full width) ─────────────────────────
            int online   = BasePlayer.activePlayerList.Count;
            int fps      = (int)Performance.current.frameRate;
            int entities = BaseNetworkable.serverEntities.Count;
            float uptimeSec = UnityEngine.Time.realtimeSinceStartup;
            int uh = (int)(uptimeSec / 3600f); int um = (int)((uptimeSec % 3600f) / 60f);
            string uptime = uh > 0 ? string.Format("{0}h {1}m", uh, um) : string.Format("{0}m", um);

            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.020 0.920", AnchorMax = "0.980 0.978" } }, UiBody, "MRAP_SVST");
            // Status dot + label
            ui.Add(new CuiPanel { Image = { Color = CGreen }, RectTransform = { AnchorMin = "0.018 0.32", AnchorMax = "0.036 0.68" } }, "MRAP_SVST");
            ui.Add(new CuiLabel { Text = { Text = "ONLINE", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CGreen, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.042 0", AnchorMax = "0.140 1" } }, "MRAP_SVST");
            // Divider
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.148 0.20", AnchorMax = "0.152 0.80" } }, "MRAP_SVST");
            // Stats
            string[] statLabels = { string.Format("{0} players", online), string.Format("{0} fps", fps), string.Format("{0} entities", entities), string.Format("up {0}", uptime) };
            for (int i = 0; i < statLabels.Length; i++) {
                float sx0 = 0.158f + i * 0.190f;
                ui.Add(new CuiLabel { Text = { Text = statLabels[i], FontSize = 10, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" }, RectTransform = { AnchorMin = string.Format("{0:F3} 0", sx0), AnchorMax = string.Format("{0:F3} 1", sx0 + 0.185f) } }, "MRAP_SVST");
            }

            // ── Left column: Time + Quick Actions ─────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.020 0.478", AnchorMax = "0.485 0.912" } }, UiBody, "MRAP_SVT");
            SectionHeader(ui, "MRAP_SVT", "TIME OF DAY");

            ui.Add(new CuiLabel { Text = { Text = FormatHour(s.SvTimeHour), FontSize = 26, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.06 0.56", AnchorMax = "0.66 0.82" } }, "MRAP_SVT");
            float tMinus = ((s.SvTimeHour - 1f) + 24f) % 24f;
            float tPlus  = (s.SvTimeHour + 1f) % 24f;
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tMinus), Color = CCell }, RectTransform = { AnchorMin = "0.62 0.60", AnchorMax = "0.80 0.80" }, Text = { Text = "- 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted } }, "MRAP_SVT");
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tPlus),  Color = COrangeDeep }, RectTransform = { AnchorMin = "0.82 0.60", AnchorMax = "1.00 0.80" }, Text = { Text = "+ 1h", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = COrange } }, "MRAP_SVT");

            float[] tHrs  = { 6f,    9f,       12f,   18f,   22f   };
            string[] tNms = { "Dawn","Morning","Noon","Dusk","Night" };
            for (int i = 0; i < 5; i++) {
                int tc = i % 3; int tr = i / 3;
                float tw = 0.282f;
                float tx0 = 0.040f + tc * (tw + 0.024f);
                float ty1 = 0.542f - tr * 0.186f;
                float ty0 = ty1 - 0.118f;
                bool tsel = Math.Abs(s.SvTimeHour - tHrs[i]) < 0.1f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svtime {0:F1}", tHrs[i]), Color = tsel ? COrangeDeep : CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} {1:F3}", tx0, ty0), AnchorMax = string.Format("{0:F3} {1:F3}", tx0 + tw, ty1) }, Text = { Text = tNms[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = tsel ? COrange : CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVT");
            }

            // Quick actions
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.020 0.020", AnchorMax = "0.485 0.465" } }, UiBody, "MRAP_SVQ");
            SectionHeader(ui, "MRAP_SVQ", "QUICK ACTIONS");

            string[] qCmds   = { "save",        "supply",       "healall"  };
            string[] qLabels = { "Save Server", "Supply Drop",  "Heal All" };
            string[] qBg     = { CGreenDeep,     COrangeDeep,    CGreenDeep };
            string[] qClrs   = { CGreen,          COrange,        CGreen     };
            for (int i = 0; i < 3; i++) {
                float qy1 = 0.760f - i * 0.228f;
                float qy0 = qy1 - 0.188f;
                string qn = string.Format("MRAP_QA{0}", i);
                ui.Add(new CuiPanel { Image = { Color = qBg[i] }, RectTransform = { AnchorMin = string.Format("0.040 {0:F3}", qy0), AnchorMax = string.Format("0.960 {0:F3}", qy1) } }, "MRAP_SVQ", qn);
                ui.Add(new CuiPanel { Image = { Color = qClrs[i] }, RectTransform = { AnchorMin = "0 0", AnchorMax = "0.020 1" } }, qn);
                ui.Add(new CuiLabel { Text = { Text = qLabels[i], FontSize = 12, Align = TextAnchor.MiddleLeft, Color = qClrs[i], Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.08 0", AnchorMax = "0.98 1" } }, qn);
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svcmd {0}", qCmds[i]), Color = "0 0 0 0" }, RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }, Text = { Text = "" } }, qn);
            }

            // ── Right column: Weather ─────────────────────────────────────────
            ui.Add(new CuiPanel { Image = { Color = CPanel }, RectTransform = { AnchorMin = "0.515 0.020", AnchorMax = "0.980 0.912" } }, UiBody, "MRAP_SVW");
            SectionHeader(ui, "MRAP_SVW", "WEATHER");

            string[] wpCmds  = { "clear", "overcast", "rain", "fog", "storm" };
            string[] wpNames = { "Clear", "Overcast", "Rain", "Fog", "Storm" };
            for (int i = 0; i < 5; i++) {
                float wx0 = 0.030f + i * 0.188f;
                ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwp {0}", wpCmds[i]), Color = CCell }, RectTransform = { AnchorMin = string.Format("{0:F3} 0.790", wx0), AnchorMax = string.Format("{0:F3} 0.878", wx0 + 0.178f) }, Text = { Text = wpNames[i], FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted, Font = "robotocondensed-bold.ttf" } }, "MRAP_SVW");
            }

            AddWeatherBar(ui, "MRAP_SVW", "rain",   "Rain",   s.SvRain,   "0.22 0.50 0.88 0.70", 0.595f, 0.755f);
            AddWeatherBar(ui, "MRAP_SVW", "fog",    "Fog",    s.SvFog,    "0.68 0.70 0.74 0.65", 0.425f, 0.585f);
            AddWeatherBar(ui, "MRAP_SVW", "clouds", "Clouds", s.SvClouds, "0.82 0.84 0.88 0.55", 0.255f, 0.415f);
            AddWeatherBar(ui, "MRAP_SVW", "wind",   "Wind",   s.SvWind,   "0.14 0.62 0.62 0.70", 0.085f, 0.245f);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        void SectionHeader(CuiElementContainer ui, string parent, string label) {
            ui.Add(new CuiPanel { Image = { Color = COrangeDim }, RectTransform = { AnchorMin = "0.022 0.882", AnchorMax = "0.038 0.976" } }, parent);
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = "0.050 0.880", AnchorMax = "0.980 0.978" } }, parent);
            ui.Add(new CuiPanel { Image = { Color = CDivider }, RectTransform = { AnchorMin = "0.022 0.866", AnchorMax = "0.978 0.874" } }, parent);
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
            ui.Add(new CuiLabel { Text = { Text = label, FontSize = 11, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-bold.ttf" }, RectTransform = { AnchorMin = string.Format("0.028 {0:F3}", y0), AnchorMax = string.Format("0.162 {0:F3}", y1) } }, par);
            string barId = par + "_b_" + key;
            ui.Add(new CuiPanel { Image = { Color = "0.046 0.058 0.076 1" }, RectTransform = { AnchorMin = string.Format("0.170 {0:F3}", y0 + pad), AnchorMax = string.Format("0.720 {0:F3}", y1 - pad) } }, par, barId);
            if (value > 0.005f) ui.Add(new CuiPanel { Image = { Color = fillClr }, RectTransform = { AnchorMin = "0 0", AnchorMax = string.Format("{0:F3} 1", value) } }, barId);
            ui.Add(new CuiLabel { Text = { Text = string.Format("{0}%", (int)(value * 100)), FontSize = 9, Align = TextAnchor.MiddleCenter, Color = CMuted }, RectTransform = { AnchorMin = string.Format("0.724 {0:F3}", y0), AnchorMax = string.Format("0.820 {0:F3}", y1) } }, par);
            float minus = Mathf.Max(0f, value - 0.1f);
            float plus  = Mathf.Min(1f, value + 0.1f);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, minus), Color = CCell }, RectTransform = { AnchorMin = string.Format("0.828 {0:F3}", y0 + pad), AnchorMax = string.Format("0.910 {0:F3}", y1 - pad) }, Text = { Text = "-", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = CText } }, par);
            ui.Add(new CuiButton { Button = { Command = string.Format("mrap.svwv {0} {1:F2}", key, plus),  Color = COrangeDeep }, RectTransform = { AnchorMin = string.Format("0.916 {0:F3}", y0 + pad), AnchorMax = string.Format("0.996 {0:F3}", y1 - pad) }, Text = { Text = "+", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = COrange } }, par);
        }

        List<string> FilteredItems(string cat, string query) {
            var all = ItemsFor(cat);
            if (string.IsNullOrEmpty(query)) return all;
            var q = query;
            var result = new List<string>();
            foreach (var sn in all) {
                if (sn.Contains(q)) { result.Add(sn); continue; }
                var def = ItemManager.FindItemDefinition(sn);
                if (def != null && def.displayName.translated.ToLower().Contains(q)) result.Add(sn);
            }
            return result;
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
