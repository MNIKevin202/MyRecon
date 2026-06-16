using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.1.0")]
    [Description("MyRcon exclusive in-game admin panel — Give Item UI")]
    public class MyRconAdminPanel : RustPlugin
    {
        private const string PermUse = "myrconadminpanel.use";
        private const string UiMain  = "MRAP_Main";
        private const string UiTabs  = "MRAP_Tabs";
        private const string UiGrid  = "MRAP_Grid";
        private const string UiGive  = "MRAP_Give";

        // ── Palette ───────────────────────────────────────────────────────────
        private const string CBg        = "0.06 0.07 0.09 0.98";   // main bg
        private const string CPanel     = "0.07 0.085 0.105 1";    // header/sidebar bg
        private const string CCell      = "0.09 0.11 0.135 1";     // item cell
        private const string CCellSel   = "0.18 0.09 0.02 1";      // selected cell bg
        private const string CDivider   = "1 1 1 0.06";
        private const string COrange    = "0.94 0.42 0.06 1";
        private const string COrangeDim = "0.94 0.42 0.06 0.18";
        private const string CText      = "0.92 0.93 0.95 1";
        private const string CMuted     = "0.52 0.57 0.63 1";
        private const string CDim       = "0.3 0.35 0.4 1";
        private const string CBtnOff    = "0.1 0.13 0.17 1";

        // ── Grid ─────────────────────────────────────────────────────────────
        private const int Cols    = 6;
        private const int Rows    = 4;
        private const int PerPage = Cols * Rows; // 24

        // ── Item catalogue ────────────────────────────────────────────────────
        private static readonly Dictionary<string, List<string>> Categories =
            new Dictionary<string, List<string>>
        {
            ["Weapons"] = new List<string>
            {
                "rifle.ak","rifle.bolt","rifle.lr300","rifle.m39","rifle.semiauto",
                "lmg.m249","smg.mp5","smg.thompson","smg.2",
                "shotgun.pump","shotgun.spas12","shotgun.double","shotgun.waterpipe",
                "pistol.m92","pistol.python","pistol.revolver","pistol.semiauto","pistol.eoka",
                "bow.hunting","bow.compound","crossbow","rocket.launcher",
                "multiplegrenadelauncher","flamethrower","knife.combat","mace","spear.wooden"
            },
            ["Ammo"] = new List<string>
            {
                "ammo.rifle","ammo.rifle.explosive","ammo.rifle.hv","ammo.rifle.incendiary",
                "ammo.pistol","ammo.pistol.hv","ammo.pistol.fire",
                "ammo.shotgun","ammo.shotgun.slug","ammo.shotgun.fire","ammo.handmade.shell",
                "arrow.wooden","arrow.hv","arrow.fire",
                "ammo.rocket.basic","ammo.rocket.hv","ammo.rocket.fire",
                "40mm.grenade.he","40mm.grenade.smoke"
            },
            ["Explosives"] = new List<string>
            {
                "explosive.timed","explosive.satchel","grenade.f1","grenade.beancan",
                "surveycharge","gunpowder","explosives"
            },
            ["Medical"] = new List<string>
            {
                "syringe.medical","bandage","largemedkit","antiradpills"
            },
            ["Resources"] = new List<string>
            {
                "wood","stones","metal.ore","sulfur.ore","hq.metal.ore",
                "metal.fragments","sulfur","metal.refined",
                "lowgradefuel","fat.animal","cloth","leather",
                "bone.fragments","scrap","charcoal","crude.oil"
            },
            ["Components"] = new List<string>
            {
                "gears","metalblade","metalspring","roadsigns","rope",
                "riflebody","semibody","smgbody","techparts",
                "tarp","sewingkit","sheetmetal","propanetank","piperifle"
            },
            ["Attire"] = new List<string>
            {
                "metal.facemask","metal.plate.torso","roadsign.jacket","roadsign.kilt",
                "hoodie","pants","shoes.boots","hat.helmet","riot.helmet",
                "hazmatsuit","coffeecan.helmet","jacket","tactical.gloves","nightvisiongoggles"
            },
            ["Tools"] = new List<string>
            {
                "hammer","building.planner","torch","flashlight.held",
                "jackhammer","chainsaw","tool.camera","wiretool","hose.tool",
                "stonehatchet","pickaxe","hatchet","icepick.salvaged"
            },
            ["Building"] = new List<string>
            {
                "door.hinged.wood","door.hinged.metal","door.hinged.toptier",
                "wall.frame.garagedoor","furnace","campfire",
                "workbench1","workbench2","workbench3",
                "box.wooden.large","lock.code","lock.key",
                "furnace.large","refinery.small","turret","sleepingbag","bed"
            },
            ["Food"] = new List<string>
            {
                "apple","blueberries","mushroom","corn","pumpkin",
                "chicken.cooked","can.beans","can.tuna",
                "water.bottle","water.jug","fish.cooked","bearmeat.cooked","wolfmeat.cooked"
            },
            ["Misc"] = new List<string>
            {
                "key.card.green","key.card.blue","key.card.red",
                "map","paper","supply.signal","targeting.computer","fun.guitar"
            }
        };

        private static readonly List<string> AllCats;
        static MyRconAdminPanel()
        {
            AllCats = new List<string> { "All" };
            AllCats.AddRange(Categories.Keys);
        }

        // ── Per-player state ──────────────────────────────────────────────────
        private class S
        {
            public string Cat     = "All";
            public int    Page    = 0;
            public string Item    = null;
            public string Name    = null;
            public int    Stack   = 1;
            public ulong  Target  = 0;
            public string Amt     = "100";
            public int    Custom  = 100;
        }

        private readonly Dictionary<ulong, S> _s = new Dictionary<ulong, S>();
        private S Get(BasePlayer p) { if (!_s.ContainsKey(p.userID)) _s[p.userID] = new S(); return _s[p.userID]; }

        // ── Oxide hooks ───────────────────────────────────────────────────────
        void Init() => permission.RegisterPermission(PermUse, this);
        void Unload() { foreach (var p in BasePlayer.activePlayerList) CuiHelper.DestroyUi(p, UiMain); _s.Clear(); }
        void OnPlayerDisconnected(BasePlayer p, string r) { CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID); }

        [ChatCommand("ap")]
        void CmdAp(BasePlayer p, string c, string[] a) => Open(p);
        [ChatCommand("adminpanel")]
        void CmdPanel(BasePlayer p, string c, string[] a) => Open(p);

        void Open(BasePlayer p)
        {
            if (!permission.UserHasPermission(p.UserIDString, PermUse))
            { SendReply(p, "<color=#F06A0F>MyRcon Admin Panel</color>: You don't have permission."); return; }
            Draw(p);
        }

        [ConsoleCommand("mrap.close")]
        void CmdClose(ConsoleSystem.Arg a) { var p = a.Player(); if (p == null) return; CuiHelper.DestroyUi(p, UiMain); _s.Remove(p.userID); }

        [ConsoleCommand("mrap.cat")]
        void CmdCat(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); s.Cat = a.GetString(0); s.Page = 0; s.Item = null; s.Target = 0; Draw(p);
        }

        [ConsoleCommand("mrap.page")]
        void CmdPage(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).Page = a.GetInt(0); Draw(p);
        }

        [ConsoleCommand("mrap.item")]
        void CmdItem(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var sn = a.GetString(0); var def = ItemManager.FindItemDefinition(sn); if (def == null) return;
            var s = Get(p); s.Item = sn; s.Name = def.displayName.translated; s.Stack = def.stackable; s.Target = 0; Draw(p);
        }

        [ConsoleCommand("mrap.target")]
        void CmdTarget(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            var s = Get(p); var id = a.GetUInt64(0); s.Target = s.Target == id ? 0UL : id; Draw(p);
        }

        [ConsoleCommand("mrap.amt")]
        void CmdAmt(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            Get(p).Amt = a.GetString(0); Draw(p);
        }

        [ConsoleCommand("mrap.custom")]
        void CmdCustom(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null || !a.HasArgs()) return;
            if (int.TryParse(a.GetString(0), out int n) && n > 0) Get(p).Custom = Math.Min(n, 100000);
            Draw(p);
        }

        [ConsoleCommand("mrap.give")]
        void CmdGive(ConsoleSystem.Arg a)
        {
            var p = a.Player(); if (p == null) return;
            var s = Get(p); if (string.IsNullOrEmpty(s.Item) || s.Target == 0) return;
            var tgt = BasePlayer.FindByID(s.Target);
            if (tgt == null) { SendReply(p, "<color=#F06A0F>MyRcon</color>: Player disconnected."); return; }
            int amt  = Resolve(s);
            var item = ItemManager.CreateByName(s.Item, amt);
            if (item == null) { SendReply(p, $"<color=#F06A0F>MyRcon</color>: Unknown item."); return; }
            tgt.GiveItem(item);
            Puts($"[AdminPanel] {p.displayName} gave {amt}x {s.Item} → {tgt.displayName}");
            SendReply(p, $"<color=#F06A0F>MyRcon</color>: Gave <color=#fff>{amt:N0}×</color> <color=#F06A0F>{s.Name}</color> to <color=#fff>{tgt.displayName}</color>.");
            s.Target = 0; Draw(p);
        }

        // ── Draw ──────────────────────────────────────────────────────────────

        void Draw(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UiMain);
            var s  = Get(player);
            var ui = new CuiElementContainer();

            // Root — compact centered panel, not full-screen
            ui.Add(new CuiPanel
            {
                Image           = { Color = CBg },
                RectTransform   = { AnchorMin = "0.15 0.08", AnchorMax = "0.85 0.93" },
                CursorEnabled   = true,
                KeyboardEnabled = false
            }, "Overlay", UiMain);

            DrawHeader(ui, s);
            DrawCategoryTabs(ui, s);
            DrawGrid(ui, s);
            if (s.Item != null) DrawGivePanel(ui, s, player);

            CuiHelper.AddUi(player, ui);
        }

        // ── Header ────────────────────────────────────────────────────────────

        void DrawHeader(CuiElementContainer ui, S s)
        {
            ui.Add(new CuiPanel
            {
                Image         = { Color = CPanel },
                RectTransform = { AnchorMin = "0 0.945", AnchorMax = "1 1" }
            }, UiMain, "MRAP_H");

            // Orange accent line at top
            ui.Add(new CuiPanel
            {
                Image         = { Color = COrange },
                RectTransform = { AnchorMin = "0 0.92", AnchorMax = "1 1" }
            }, "MRAP_H");

            // Logo
            ui.Add(new CuiLabel
            {
                Text          = { Text = "MyRcon", FontSize = 14, Align = TextAnchor.MiddleLeft, Color = COrange, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.014 0.05", AnchorMax = "0.16 0.9" }
            }, "MRAP_H");

            // Divider
            ui.Add(new CuiPanel
            {
                Image         = { Color = CDivider },
                RectTransform = { AnchorMin = "0.155 0.2", AnchorMax = "0.158 0.8" }
            }, "MRAP_H");

            // Title
            ui.Add(new CuiLabel
            {
                Text          = { Text = "Admin Panel", FontSize = 12, Align = TextAnchor.MiddleLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.165 0.05", AnchorMax = "0.55 0.9" }
            }, "MRAP_H");

            // Hint
            ui.Add(new CuiLabel
            {
                Text          = { Text = "/ap  ·  /adminpanel", FontSize = 9, Align = TextAnchor.MiddleRight, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.55 0.1", AnchorMax = "0.92 0.9" }
            }, "MRAP_H");

            // Close button — prominent X
            ui.Add(new CuiButton
            {
                Button        = { Command = "mrap.close", Color = "0.65 0.15 0.1 0.7" },
                RectTransform = { AnchorMin = "0.93 0.1", AnchorMax = "0.997 0.88" },
                Text          = { Text = "✕", FontSize = 16, Align = TextAnchor.MiddleCenter, Color = "1 0.75 0.7 1", Font = "robotocondensed-bold.ttf" }
            }, "MRAP_H");
        }

        // ── Category tabs (horizontal strip) ──────────────────────────────────

        void DrawCategoryTabs(CuiElementContainer ui, S s)
        {
            float gridRight = s.Item != null ? 0.655f : 1f;

            ui.Add(new CuiPanel
            {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = $"0 0.895", AnchorMax = $"{gridRight:F3} 0.942" }
            }, UiMain, UiTabs);

            // Bottom separator
            ui.Add(new CuiPanel
            {
                Image         = { Color = CDivider },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.06" }
            }, UiTabs);

            float tabW = 1f / AllCats.Count;
            for (int i = 0; i < AllCats.Count; i++)
            {
                string cat    = AllCats[i];
                bool   active = s.Cat == cat;
                float  xMin   = i * tabW;
                float  xMax   = xMin + tabW;

                if (active)
                {
                    // Active bg
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = COrangeDim },
                        RectTransform = { AnchorMin = $"{xMin:F3} 0.08", AnchorMax = $"{xMax:F3} 1" }
                    }, UiTabs);
                    // Bottom active indicator
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = COrange },
                        RectTransform = { AnchorMin = $"{xMin:F3} 0", AnchorMax = $"{xMax:F3} 0.12" }
                    }, UiTabs);
                }

                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.cat {cat}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = $"{xMin:F3} 0.08", AnchorMax = $"{xMax:F3} 1" },
                    Text          = { Text = cat, FontSize = 9, Align = TextAnchor.MiddleCenter, Color = active ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" }
                }, UiTabs);
            }
        }

        // ── Item grid ─────────────────────────────────────────────────────────

        void DrawGrid(CuiElementContainer ui, S s)
        {
            float xRight = s.Item != null ? 0.655f : 1f;

            ui.Add(new CuiPanel
            {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0.05", AnchorMax = $"{xRight:F3} 0.893" }
            }, UiMain, UiGrid);

            var items  = ItemsFor(s.Cat);
            int pages  = Math.Max(1, (int)Math.Ceiling(items.Count / (float)PerPage));
            s.Page     = Mathf.Clamp(s.Page, 0, pages - 1);
            var page   = items.Skip(s.Page * PerPage).Take(PerPage).ToList();

            const float gX = 0.008f;
            const float gY = 0.01f;
            const float bH = 0.09f; // pagination bar
            float cW = (1f - gX * (Cols + 1)) / Cols;
            float cH = (1f - bH - gY * (Rows + 1)) / Rows;

            for (int i = 0; i < page.Count; i++)
            {
                string sn  = page[i];
                var    def = ItemManager.FindItemDefinition(sn);
                if (def == null) continue;

                int   col  = i % Cols;
                int   row  = i / Cols;
                float xMin = gX + col * (cW + gX);
                float yMin = bH + gY + (Rows - 1 - row) * (cH + gY);
                bool  sel  = s.Item == sn;
                string cn  = $"MRAP_I{i}";

                // Cell background
                ui.Add(new CuiPanel
                {
                    Image         = { Color = sel ? CCellSel : CCell },
                    RectTransform = { AnchorMin = $"{xMin:F3} {yMin:F3}", AnchorMax = $"{xMin+cW:F3} {yMin+cH:F3}" }
                }, UiGrid, cn);

                // Left accent on selected
                if (sel)
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = COrange },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "0.025 1" }
                    }, cn);

                // ── Native game item icon (same as F1 inventory) ──────────────
                ui.Add(new CuiElement
                {
                    Parent     = cn,
                    Components =
                    {
                        new CuiImageComponent { ItemId = def.itemid, SkinId = 0 },
                        new CuiRectTransformComponent { AnchorMin = "0.1 0.28", AnchorMax = "0.9 0.94" }
                    }
                });

                // Item name label
                ui.Add(new CuiLabel
                {
                    Text          = { Text = def.displayName.translated, FontSize = 7, Align = TextAnchor.MiddleCenter, Color = sel ? "1 0.82 0.62 1" : CDim, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = "0.02 0.01", AnchorMax = "0.98 0.28" }
                }, cn);

                // Transparent click target
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.item {sn}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                    Text          = { Text = "" }
                }, cn);
            }

            // Pagination
            ui.Add(new CuiLabel
            {
                Text          = { Text = $"{s.Cat}  ·  {items.Count} items  ·  {s.Page + 1}/{pages}", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.01 0.005", AnchorMax = "0.55 0.075" }
            }, UiGrid);

            if (s.Page > 0)
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.page {s.Page - 1}", Color = CCell },
                    RectTransform = { AnchorMin = "0.57 0.008", AnchorMax = "0.77 0.078" },
                    Text          = { Text = "◄  Prev", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted }
                }, UiGrid);

            if (s.Page < pages - 1)
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.page {s.Page + 1}", Color = CCell },
                    RectTransform = { AnchorMin = "0.79 0.008", AnchorMax = "0.998 0.078" },
                    Text          = { Text = "Next  ►", FontSize = 10, Align = TextAnchor.MiddleCenter, Color = CMuted }
                }, UiGrid);
        }

        // ── Give panel ────────────────────────────────────────────────────────

        void DrawGivePanel(CuiElementContainer ui, S s, BasePlayer invoker)
        {
            ui.Add(new CuiPanel
            {
                Image         = { Color = CPanel },
                RectTransform = { AnchorMin = "0.66 0", AnchorMax = "1 0.942" }
            }, UiMain, UiGive);

            // Left divider
            ui.Add(new CuiPanel
            {
                Image         = { Color = CDivider },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "0.005 1" }
            }, UiGive);

            // ── Item header ───────────────────────────────────────────────────
            ui.Add(new CuiPanel
            {
                Image         = { Color = "0.05 0.06 0.08 1" },
                RectTransform = { AnchorMin = "0 0.895", AnchorMax = "1 1" }
            }, UiGive, "MRAP_GH");

            // Native item icon
            ui.Add(new CuiElement
            {
                Parent     = "MRAP_GH",
                Components =
                {
                    new CuiImageComponent { ItemId = ItemManager.FindItemDefinition(s.Item)?.itemid ?? 0, SkinId = 0 },
                    new CuiRectTransformComponent { AnchorMin = "0.04 0.08", AnchorMax = "0.22 0.92" }
                }
            });

            ui.Add(new CuiLabel
            {
                Text          = { Text = s.Name ?? s.Item, FontSize = 11, Align = TextAnchor.UpperLeft, Color = CText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.25 0.5", AnchorMax = "0.98 0.95" }
            }, "MRAP_GH");

            ui.Add(new CuiLabel
            {
                Text          = { Text = s.Item, FontSize = 8, Align = TextAnchor.LowerLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.25 0.05", AnchorMax = "0.98 0.52" }
            }, "MRAP_GH");

            // ── GIVE TO section label ─────────────────────────────────────────
            ui.Add(new CuiLabel
            {
                Text          = { Text = "GIVE TO", FontSize = 7, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.05 0.848", AnchorMax = "0.95 0.89" }
            }, UiGive);

            // ── Player list ───────────────────────────────────────────────────
            var players = BasePlayer.activePlayerList
                .OrderBy(p => p.userID != invoker.userID)
                .ThenBy(p => p.displayName)
                .ToList();

            const float rH    = 0.058f;
            const float rGap  = 0.005f;
            float       rTop  = 0.845f;
            const int   maxR  = 8;

            for (int i = 0; i < Math.Min(players.Count, maxR); i++)
            {
                var  pl   = players[i];
                bool inv  = pl.userID == invoker.userID;
                bool sel  = s.Target == pl.userID;
                float yMx = rTop - i * (rH + rGap);
                float yMn = yMx - rH;
                string rn = $"MRAP_P{i}";

                ui.Add(new CuiPanel
                {
                    Image         = { Color = sel ? "0.15 0.08 0.02 1" : "0.075 0.09 0.11 1" },
                    RectTransform = { AnchorMin = $"0.04 {yMn:F3}", AnchorMax = $"0.96 {yMx:F3}" }
                }, UiGive, rn);

                // Selection indicator bar
                ui.Add(new CuiPanel
                {
                    Image         = { Color = sel ? COrange : CDivider },
                    RectTransform = { AnchorMin = "0 0.15", AnchorMax = "0.015 0.85" }
                }, rn);

                // Name
                ui.Add(new CuiLabel
                {
                    Text          = { Text = pl.displayName, FontSize = 10, Align = TextAnchor.MiddleLeft, Color = sel ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" },
                    RectTransform = { AnchorMin = "0.06 0", AnchorMax = inv ? "0.72 1" : "0.97 1" }
                }, rn);

                // YOU badge
                if (inv)
                {
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = COrangeDim },
                        RectTransform = { AnchorMin = "0.74 0.18", AnchorMax = "0.98 0.82" }
                    }, rn);
                    ui.Add(new CuiLabel
                    {
                        Text          = { Text = "YOU", FontSize = 7, Align = TextAnchor.MiddleCenter, Color = COrange, Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.74 0.18", AnchorMax = "0.98 0.82" }
                    }, rn);
                }

                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.target {pl.userID}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                    Text          = { Text = "" }
                }, rn);
            }

            if (players.Count > maxR)
                ui.Add(new CuiLabel
                {
                    Text          = { Text = $"+{players.Count - maxR} more online", FontSize = 8, Align = TextAnchor.MiddleCenter, Color = CDim },
                    RectTransform = { AnchorMin = "0.04 0.375", AnchorMax = "0.96 0.415" }
                }, UiGive);

            // ── AMOUNT section label ──────────────────────────────────────────
            ui.Add(new CuiLabel
            {
                Text          = { Text = "AMOUNT", FontSize = 7, Align = TextAnchor.MiddleLeft, Color = CDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.05 0.337", AnchorMax = "0.95 0.372" }
            }, UiGive);

            // ── Amount buttons (2×2) ──────────────────────────────────────────
            var modes = new (string m, string l)[]
            {
                ("100", "100"),
                ("1000", "1,000"),
                ("stack", $"Stack ({s.Stack})"),
                ("custom", "Custom")
            };

            const float bH   = 0.062f;
            const float bGap = 0.01f;
            float       bTop = 0.334f;

            for (int i = 0; i < 4; i++)
            {
                var (m, l) = modes[i];
                bool on    = s.Amt == m;
                int  col   = i % 2;
                int  row   = i / 2;
                float xMn  = 0.04f + col * (0.475f + bGap);
                float yMx  = bTop - row * (bH + bGap);
                float yMn2 = yMx - bH;

                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.amt {m}", Color = on ? COrangeDim : "0.08 0.1 0.13 1" },
                    RectTransform = { AnchorMin = $"{xMn:F3} {yMn2:F3}", AnchorMax = $"{xMn+0.475f:F3} {yMx:F3}" },
                    Text          = { Text = l, FontSize = 9, Align = TextAnchor.MiddleCenter, Color = on ? "1 0.82 0.62 1" : CMuted, Font = "robotocondensed-regular.ttf" }
                }, UiGive);
            }

            float baseY = bTop - 2 * (bH + bGap);

            // Custom input field
            if (s.Amt == "custom")
            {
                ui.Add(new CuiPanel
                {
                    Image         = { Color = "0.08 0.1 0.13 1" },
                    RectTransform = { AnchorMin = $"0.04 {baseY - 0.072f:F3}", AnchorMax = $"0.96 {baseY:F3}" }
                }, UiGive, "MRAP_In");

                ui.Add(new CuiElement
                {
                    Name   = "MRAP_InF",
                    Parent = "MRAP_In",
                    Components =
                    {
                        new CuiInputFieldComponent { Text = s.Custom.ToString(), FontSize = 13, Align = TextAnchor.MiddleCenter, Command = "mrap.custom", Color = CText, CharsLimit = 6 },
                        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                    }
                });

                baseY -= 0.08f;
            }

            // Summary line
            int res = Resolve(s);
            ui.Add(new CuiLabel
            {
                Text          = { Text = $"→  {res:N0} ×  {(s.Name ?? s.Item)}", FontSize = 9, Align = TextAnchor.MiddleLeft, Color = CMuted, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = $"0.04 {baseY - 0.04f:F3}", AnchorMax = $"0.96 {baseY:F3}" }
            }, UiGive);

            // ── GIVE button ───────────────────────────────────────────────────
            bool can = s.Target != 0;
            ui.Add(new CuiButton
            {
                Button        = { Command = can ? "mrap.give" : "", Color = can ? COrange : CBtnOff },
                RectTransform = { AnchorMin = "0.04 0.022", AnchorMax = "0.96 0.098" },
                Text          = { Text = can ? $"Give  {res:N0} ×" : "Select a player", FontSize = 12, Align = TextAnchor.MiddleCenter, Color = can ? "1 1 1 1" : CDim, Font = "robotocondensed-bold.ttf" }
            }, UiGive);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        static List<string> ItemsFor(string cat)
        {
            if (cat == "All") return Categories.Values.SelectMany(x => x).ToList();
            return Categories.TryGetValue(cat, out var l) ? l : new List<string>();
        }

        static int Resolve(S s)
        {
            switch (s.Amt)
            {
                case "100":    return 100;
                case "1000":   return 1000;
                case "stack":  return Math.Max(1, s.Stack);
                case "custom": return Math.Max(1, s.Custom);
                default:       return 100;
            }
        }
    }
}
