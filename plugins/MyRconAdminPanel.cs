using System;
using System.Collections.Generic;
using System.Linq;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconAdminPanel", "MyRcon", "1.0.0")]
    [Description("MyRcon exclusive in-game admin panel — Give Item UI")]
    public class MyRconAdminPanel : RustPlugin
    {
        // ─────────────────────────────────────────────────────────────
        //  Constants
        // ─────────────────────────────────────────────────────────────

        private const string PermUse  = "myrconadminpanel.use";
        private const string UiMain   = "MRAP_Main";
        private const string UiGrid   = "MRAP_Grid";
        private const string UiGive   = "MRAP_Give";
        private const string ImageCdn = "https://cdn.rusthelper.com/item";

        // Colour palette (matches MyRcon dark theme)
        private const string ColBg         = "0.055 0.065 0.08 0.97";
        private const string ColHeader     = "0.07  0.085 0.105 1";
        private const string ColSidebar    = "0.065 0.078 0.095 1";
        private const string ColCell       = "0.085 0.1   0.125 1";
        private const string ColCellSel    = "1 0.45 0.1 0.18";
        private const string ColBorder     = "1 1 1 0.055";
        private const string ColOrange     = "1 0.45 0.1 1";
        private const string ColOrangeDim  = "1 0.45 0.1 0.22";
        private const string ColText       = "1 1 1 1";
        private const string ColTextMuted  = "0.6 0.65 0.7 1";
        private const string ColTextDim    = "0.38 0.43 0.5 1";
        private const string ColGiveBtnOff = "0.13 0.16 0.2 1";
        private const string ColSuccess    = "0.22 0.68 0.38 1";

        private const int GridCols    = 5;
        private const int GridRows    = 4;
        private const int ItemsPerPage = GridCols * GridRows;

        // ─────────────────────────────────────────────────────────────
        //  Item catalogue  (shortname → resolved from ItemManager)
        // ─────────────────────────────────────────────────────────────

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
            ["Ammunition"] = new List<string>
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

        private static readonly List<string> AllCategories;

        static MyRconAdminPanel()
        {
            AllCategories = new List<string> { "All" };
            AllCategories.AddRange(Categories.Keys);
        }

        // ─────────────────────────────────────────────────────────────
        //  Per-player state
        // ─────────────────────────────────────────────────────────────

        private class PlayerState
        {
            public string  Category        = "All";
            public int     Page            = 0;
            public string  SelectedItem    = null;
            public string  SelectedName    = null;
            public int     SelectedStack   = 1;
            public ulong   TargetId        = 0;
            public string  AmountMode      = "100";   // "100" | "1000" | "stack" | "custom"
            public int     CustomAmount    = 100;
        }

        private readonly Dictionary<ulong, PlayerState> _states =
            new Dictionary<ulong, PlayerState>();

        private PlayerState State(BasePlayer p)
        {
            if (!_states.ContainsKey(p.userID))
                _states[p.userID] = new PlayerState();
            return _states[p.userID];
        }

        // ─────────────────────────────────────────────────────────────
        //  Oxide hooks
        // ─────────────────────────────────────────────────────────────

        private void Init()
        {
            permission.RegisterPermission(PermUse, this);
        }

        private void Unload()
        {
            foreach (var p in BasePlayer.activePlayerList)
                CuiHelper.DestroyUi(p, UiMain);
            _states.Clear();
        }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            CuiHelper.DestroyUi(player, UiMain);
            _states.Remove(player.userID);
        }

        // ─────────────────────────────────────────────────────────────
        //  Chat / console commands
        // ─────────────────────────────────────────────────────────────

        [ChatCommand("ap")]
        private void CmdAp(BasePlayer player, string cmd, string[] args) => Open(player);

        [ChatCommand("adminpanel")]
        private void CmdAdminPanel(BasePlayer player, string cmd, string[] args) => Open(player);

        private void Open(BasePlayer player)
        {
            if (!permission.UserHasPermission(player.UserIDString, PermUse))
            {
                SendReply(player, "<color=#f07219>MyRcon Admin Panel</color>: No permission.");
                return;
            }
            Draw(player);
        }

        [ConsoleCommand("mrap.close")]
        private void CmdClose(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null) return;
            CuiHelper.DestroyUi(p, UiMain);
            _states.Remove(p.userID);
        }

        [ConsoleCommand("mrap.category")]
        private void CmdCategory(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            var s = State(p);
            s.Category     = arg.GetString(0);
            s.Page         = 0;
            s.SelectedItem = null;
            s.TargetId     = 0;
            Draw(p);
        }

        [ConsoleCommand("mrap.page")]
        private void CmdPage(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            State(p).Page = arg.GetInt(0);
            Draw(p);
        }

        [ConsoleCommand("mrap.selectitem")]
        private void CmdSelectItem(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            var shortname = arg.GetString(0);
            var def = ItemManager.FindItemDefinition(shortname);
            if (def == null) return;
            var s = State(p);
            s.SelectedItem  = shortname;
            s.SelectedName  = def.displayName.translated;
            s.SelectedStack = def.stackable;
            s.TargetId      = 0;
            Draw(p);
        }

        [ConsoleCommand("mrap.selectplayer")]
        private void CmdSelectPlayer(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            var s = State(p);
            var id = arg.GetUInt64(0);
            s.TargetId = (s.TargetId == id) ? 0UL : id;
            Draw(p);
        }

        [ConsoleCommand("mrap.amount")]
        private void CmdAmount(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            State(p).AmountMode = arg.GetString(0);
            Draw(p);
        }

        [ConsoleCommand("mrap.customamount")]
        private void CmdCustomAmount(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null || !arg.HasArgs()) return;
            if (int.TryParse(arg.GetString(0), out int n) && n > 0)
                State(p).CustomAmount = Math.Min(n, 100000);
            Draw(p);
        }

        [ConsoleCommand("mrap.give")]
        private void CmdGive(ConsoleSystem.Arg arg)
        {
            var p = arg.Player();
            if (p == null) return;
            var s = State(p);
            if (string.IsNullOrEmpty(s.SelectedItem) || s.TargetId == 0) return;

            var target = BasePlayer.FindByID(s.TargetId);
            if (target == null)
            {
                SendReply(p, "<color=#f07219>MyRcon</color>: Player not found (may have disconnected).");
                return;
            }

            int amount = ResolvedAmount(s);
            var item = ItemManager.CreateByName(s.SelectedItem, amount);
            if (item == null)
            {
                SendReply(p, $"<color=#f07219>MyRcon</color>: Unknown item '{s.SelectedItem}'.");
                return;
            }

            target.GiveItem(item);

            Puts($"[AdminPanel] {p.displayName} ({p.UserIDString}) → gave {amount}x {s.SelectedItem} to {target.displayName} ({target.UserIDString})");
            SendReply(p, $"<color=#f07219>MyRcon</color>: Gave <color=#fff>{amount:N0}×</color> <color=#f07219>{s.SelectedName}</color> to <color=#fff>{target.displayName}</color>.");

            s.TargetId = 0;
            Draw(p);
        }

        // ─────────────────────────────────────────────────────────────
        //  Draw  (full panel rebuild)
        // ─────────────────────────────────────────────────────────────

        private void Draw(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UiMain);
            var s  = State(player);
            var ui = new CuiElementContainer();

            // ── Root overlay ──────────────────────────────────────────
            ui.Add(new CuiPanel
            {
                Image          = { Color = ColBg },
                RectTransform  = { AnchorMin = "0.04 0.04", AnchorMax = "0.96 0.96" },
                CursorEnabled  = true,
                KeyboardEnabled = false
            }, "Overlay", UiMain);

            DrawHeader(ui, s);
            DrawSidebar(ui, s);
            DrawGrid(ui, s);
            if (s.SelectedItem != null)
                DrawGivePanel(ui, s, player);

            CuiHelper.AddUi(player, ui);
        }

        // ── Header ────────────────────────────────────────────────────

        private void DrawHeader(CuiElementContainer ui, PlayerState s)
        {
            const string parent = "MRAP_Hdr";
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColHeader },
                RectTransform = { AnchorMin = "0 0.925", AnchorMax = "1 1" }
            }, UiMain, parent);

            // Orange top accent line
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColOrange },
                RectTransform = { AnchorMin = "0 0.94", AnchorMax = "1 1" }
            }, parent);

            // "MyRcon" wordmark
            ui.Add(new CuiLabel
            {
                Text          = { Text = "MyRcon", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = ColOrange, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.012 0", AnchorMax = "0.11 0.92" }
            }, parent);

            // Title
            ui.Add(new CuiLabel
            {
                Text          = { Text = "Admin Panel  ·  Give Item", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = ColText, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.1 0", AnchorMax = "0.75 0.92" }
            }, parent);

            // Help hint
            ui.Add(new CuiLabel
            {
                Text          = { Text = "Chat: /ap", FontSize = 9, Align = TextAnchor.MiddleRight, Color = ColTextDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.75 0", AnchorMax = "0.955 0.92" }
            }, parent);

            // Close ✕
            ui.Add(new CuiButton
            {
                Button        = { Command = "mrap.close", Color = "0.7 0.18 0.18 0.55" },
                RectTransform = { AnchorMin = "0.963 0.12", AnchorMax = "0.998 0.88" },
                Text          = { Text = "✕", FontSize = 14, Align = TextAnchor.MiddleCenter, Color = "1 0.8 0.8 1" }
            }, parent);
        }

        // ── Category sidebar ──────────────────────────────────────────

        private void DrawSidebar(CuiElementContainer ui, PlayerState s)
        {
            const string parent = "MRAP_Side";
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColSidebar },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "0.13 0.92" }
            }, UiMain, parent);

            // Right separator
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColBorder },
                RectTransform = { AnchorMin = "0.97 0", AnchorMax = "1 1" }
            }, parent);

            // Section label
            ui.Add(new CuiLabel
            {
                Text          = { Text = "CATEGORIES", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = ColTextDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.07 0.965", AnchorMax = "1 1" }
            }, parent);

            const float rowH  = 0.068f;
            const float gap   = 0.004f;
            float       startY = 0.957f;

            for (int i = 0; i < AllCategories.Count; i++)
            {
                string cat    = AllCategories[i];
                bool   active = s.Category == cat;
                float  yMax   = startY - i * (rowH + gap);
                float  yMin   = yMax - rowH;
                if (yMin < 0) break;

                if (active)
                {
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = ColOrangeDim },
                        RectTransform = { AnchorMin = $"0 {yMin:F3}", AnchorMax = $"0.97 {yMax:F3}" }
                    }, parent);
                    // Left accent bar
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = ColOrange },
                        RectTransform = { AnchorMin = $"0 {yMin:F3}", AnchorMax = $"0.025 {yMax:F3}" }
                    }, parent);
                }

                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.category {cat}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = $"0 {yMin:F3}", AnchorMax = $"0.97 {yMax:F3}" },
                    Text          =
                    {
                        Text      = "  " + cat,
                        FontSize  = 11,
                        Align     = TextAnchor.MiddleLeft,
                        Color     = active ? "1 0.85 0.7 1" : ColTextMuted,
                        Font      = "robotocondensed-regular.ttf"
                    }
                }, parent);
            }
        }

        // ── Item grid ─────────────────────────────────────────────────

        private void DrawGrid(CuiElementContainer ui, PlayerState s)
        {
            float xMax = (s.SelectedItem != null) ? 0.645f : 0.998f;

            ui.Add(new CuiPanel
            {
                Image         = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0.135 0", AnchorMax = $"{xMax:F3} 0.92" }
            }, UiMain, UiGrid);

            var items      = ItemsFor(s.Category);
            int totalPages = Math.Max(1, (int)Math.Ceiling(items.Count / (float)ItemsPerPage));
            s.Page         = Mathf.Clamp(s.Page, 0, totalPages - 1);
            var page       = items.Skip(s.Page * ItemsPerPage).Take(ItemsPerPage).ToList();

            // Cell sizing within grid panel
            const float gapX  = 0.012f;
            const float gapY  = 0.013f;
            const float botH  = 0.075f;  // pagination bar height
            float cellW = (1f - gapX * (GridCols + 1)) / GridCols;
            float cellH = (1f - botH - gapY * (GridRows + 1)) / GridRows;

            for (int i = 0; i < page.Count; i++)
            {
                string sn  = page[i];
                var    def = ItemManager.FindItemDefinition(sn);
                if (def == null) continue;

                int   col    = i % GridCols;
                int   row    = i / GridCols;
                float xMin   = gapX + col * (cellW + gapX);
                float yMin   = botH + gapY + (GridRows - 1 - row) * (cellH + gapY);
                float xMaxC  = xMin + cellW;
                float yMaxC  = yMin + cellH;

                bool   sel      = s.SelectedItem == sn;
                string cellName = $"MRAP_C{i}";

                // Cell bg
                ui.Add(new CuiPanel
                {
                    Image         = { Color = sel ? ColCellSel : ColCell },
                    RectTransform = { AnchorMin = $"{xMin:F3} {yMin:F3}", AnchorMax = $"{xMaxC:F3} {yMaxC:F3}" }
                }, UiGrid, cellName);

                // Border overlay
                ui.Add(new CuiPanel
                {
                    Image         = { Color = sel ? "1 0.55 0.15 0.7" : ColBorder },
                    RectTransform = { AnchorMin = "0 0.97", AnchorMax = "1 1" }
                }, cellName);

                // Item image
                ui.Add(new CuiElement
                {
                    Parent     = cellName,
                    Components =
                    {
                        new CuiRawImageComponent { Url = $"{ImageCdn}/{sn}/image", Color = "1 1 1 1" },
                        new CuiRectTransformComponent { AnchorMin = "0.1 0.33", AnchorMax = "0.9 0.95" }
                    }
                });

                // Item name
                ui.Add(new CuiLabel
                {
                    Text          =
                    {
                        Text     = def.displayName.translated,
                        FontSize = 8,
                        Align    = TextAnchor.MiddleCenter,
                        Color    = sel ? "1 0.85 0.7 1" : ColTextMuted,
                        Font     = "robotocondensed-regular.ttf"
                    },
                    RectTransform = { AnchorMin = "0.02 0.01", AnchorMax = "0.98 0.33" }
                }, cellName);

                // Click button
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.selectitem {sn}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                    Text          = { Text = "" }
                }, cellName);
            }

            // ── Pagination bar ────────────────────────────────────────
            ui.Add(new CuiLabel
            {
                Text          =
                {
                    Text     = $"{s.Category}  ·  {items.Count} items  ·  Page {s.Page + 1} / {totalPages}",
                    FontSize = 10,
                    Align    = TextAnchor.MiddleLeft,
                    Color    = ColTextDim,
                    Font     = "robotocondensed-regular.ttf"
                },
                RectTransform = { AnchorMin = "0.01 0.005", AnchorMax = "0.6 0.065" }
            }, UiGrid);

            if (s.Page > 0)
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.page {s.Page - 1}", Color = ColCell },
                    RectTransform = { AnchorMin = "0.61 0.005", AnchorMax = "0.79 0.065" },
                    Text          = { Text = "◄ Prev", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = ColTextMuted }
                }, UiGrid);

            if (s.Page < totalPages - 1)
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.page {s.Page + 1}", Color = ColCell },
                    RectTransform = { AnchorMin = "0.81 0.005", AnchorMax = "0.998 0.065" },
                    Text          = { Text = "Next ►", FontSize = 11, Align = TextAnchor.MiddleCenter, Color = ColTextMuted }
                }, UiGrid);
        }

        // ── Give panel ────────────────────────────────────────────────

        private void DrawGivePanel(CuiElementContainer ui, PlayerState s, BasePlayer invoker)
        {
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColSidebar },
                RectTransform = { AnchorMin = "0.655 0", AnchorMax = "1 0.92" }
            }, UiMain, UiGive);

            // Left separator
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColBorder },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "0.004 1" }
            }, UiGive);

            // ── Item header ───────────────────────────────────────────
            ui.Add(new CuiPanel
            {
                Image         = { Color = ColHeader },
                RectTransform = { AnchorMin = "0 0.905", AnchorMax = "1 1" }
            }, UiGive, "MRAP_GH");

            ui.Add(new CuiElement
            {
                Parent     = "MRAP_GH",
                Components =
                {
                    new CuiRawImageComponent { Url = $"{ImageCdn}/{s.SelectedItem}/image", Color = "1 1 1 1" },
                    new CuiRectTransformComponent { AnchorMin = "0.03 0.1", AnchorMax = "0.18 0.9" }
                }
            });

            ui.Add(new CuiLabel
            {
                Text          = { Text = s.SelectedName ?? s.SelectedItem, FontSize = 12, Align = TextAnchor.UpperLeft, Color = ColText, Font = "robotocondensed-bold.ttf" },
                RectTransform = { AnchorMin = "0.21 0.48", AnchorMax = "0.98 0.94" }
            }, "MRAP_GH");

            ui.Add(new CuiLabel
            {
                Text          = { Text = s.SelectedItem, FontSize = 9, Align = TextAnchor.LowerLeft, Color = ColTextDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.21 0.06", AnchorMax = "0.98 0.5" }
            }, "MRAP_GH");

            // ── GIVE TO ───────────────────────────────────────────────
            ui.Add(new CuiLabel
            {
                Text          = { Text = "GIVE TO", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = ColTextDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.05 0.845", AnchorMax = "0.95 0.9" }
            }, UiGive);

            var players = BasePlayer.activePlayerList
                .OrderBy(p => p.userID != invoker.userID)
                .ThenBy(p => p.displayName)
                .ToList();

            const float rowH = 0.063f;
            const float rowG = 0.005f;
            float rowTop     = 0.842f;
            const int maxRows = 7;

            for (int i = 0; i < Math.Min(players.Count, maxRows); i++)
            {
                var  pl         = players[i];
                bool isInvoker  = pl.userID == invoker.userID;
                bool isSel      = s.TargetId == pl.userID;
                float yMax      = rowTop - i * (rowH + rowG);
                float yMin      = yMax - rowH;
                string rn       = $"MRAP_PR{i}";

                ui.Add(new CuiPanel
                {
                    Image         = { Color = isSel ? "1 0.45 0.1 0.2" : ColCell },
                    RectTransform = { AnchorMin = $"0.04 {yMin:F3}", AnchorMax = $"0.96 {yMax:F3}" }
                }, UiGive, rn);

                // Checkbox
                ui.Add(new CuiPanel
                {
                    Image         = { Color = isSel ? ColOrange : "0.18 0.22 0.28 1" },
                    RectTransform = { AnchorMin = "0.04 0.22", AnchorMax = "0.16 0.78" }
                }, rn);

                if (isSel)
                    ui.Add(new CuiLabel
                    {
                        Text          = { Text = "✓", FontSize = 9, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1" },
                        RectTransform = { AnchorMin = "0.04 0.22", AnchorMax = "0.16 0.78" }
                    }, rn);

                // Name
                ui.Add(new CuiLabel
                {
                    Text          =
                    {
                        Text     = pl.displayName,
                        FontSize = 11,
                        Align    = TextAnchor.MiddleLeft,
                        Color    = isSel ? "1 0.85 0.7 1" : ColTextMuted,
                        Font     = "robotocondensed-regular.ttf"
                    },
                    RectTransform = { AnchorMin = "0.19 0", AnchorMax = isInvoker ? "0.7 1" : "0.97 1" }
                }, rn);

                // "YOU" badge
                if (isInvoker)
                {
                    ui.Add(new CuiPanel
                    {
                        Image         = { Color = ColOrangeDim },
                        RectTransform = { AnchorMin = "0.72 0.2", AnchorMax = "0.97 0.8" }
                    }, rn);
                    ui.Add(new CuiLabel
                    {
                        Text          = { Text = "YOU", FontSize = 8, Align = TextAnchor.MiddleCenter, Color = "1 0.75 0.5 1", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.72 0.2", AnchorMax = "0.97 0.8" }
                    }, rn);
                }

                // Click
                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.selectplayer {pl.userID}", Color = "0 0 0 0" },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                    Text          = { Text = "" }
                }, rn);
            }

            if (players.Count > maxRows)
                ui.Add(new CuiLabel
                {
                    Text          = { Text = $"+ {players.Count - maxRows} more online", FontSize = 9, Align = TextAnchor.MiddleCenter, Color = ColTextDim },
                    RectTransform = { AnchorMin = "0.04 0.385", AnchorMax = "0.96 0.42" }
                }, UiGive);

            // ── AMOUNT ────────────────────────────────────────────────
            ui.Add(new CuiLabel
            {
                Text          = { Text = "AMOUNT", FontSize = 8, Align = TextAnchor.MiddleLeft, Color = ColTextDim, Font = "robotocondensed-regular.ttf" },
                RectTransform = { AnchorMin = "0.05 0.345", AnchorMax = "0.95 0.385" }
            }, UiGive);

            // 2×2 grid of amount buttons
            var modes = new (string mode, string label)[]
            {
                ("100",   "100"),
                ("1000",  "1,000"),
                ("stack", $"Stack  ({s.SelectedStack})"),
                ("custom","Custom")
            };

            const float btnH   = 0.065f;
            const float btnGap = 0.012f;
            float       btnTop = 0.342f;

            for (int i = 0; i < modes.Length; i++)
            {
                var (mode, label) = modes[i];
                bool active = s.AmountMode == mode;
                int  col    = i % 2;
                int  row    = i / 2;
                float xMin  = 0.04f + col * (0.48f + btnGap);
                float yMax  = btnTop - row * (btnH + btnGap);
                float yMin  = yMax - btnH;

                ui.Add(new CuiButton
                {
                    Button        = { Command = $"mrap.amount {mode}", Color = active ? "1 0.45 0.1 0.25" : ColCell },
                    RectTransform = { AnchorMin = $"{xMin:F3} {yMin:F3}", AnchorMax = $"{xMin + 0.48f:F3} {yMax:F3}" },
                    Text          =
                    {
                        Text     = label,
                        FontSize = 10,
                        Align    = TextAnchor.MiddleCenter,
                        Color    = active ? "1 0.85 0.7 1" : ColTextMuted,
                        Font     = "robotocondensed-regular.ttf"
                    }
                }, UiGive);
            }

            // Custom amount input field
            float inputBaseY = btnTop - 2 * (btnH + btnGap);

            if (s.AmountMode == "custom")
            {
                ui.Add(new CuiPanel
                {
                    Image         = { Color = ColCell },
                    RectTransform = { AnchorMin = $"0.04 {inputBaseY - 0.075f:F3}", AnchorMax = $"0.96 {inputBaseY:F3}" }
                }, UiGive, "MRAP_Input");

                ui.Add(new CuiElement
                {
                    Name   = "MRAP_InputField",
                    Parent = "MRAP_Input",
                    Components =
                    {
                        new CuiInputFieldComponent
                        {
                            Text       = s.CustomAmount.ToString(),
                            FontSize   = 14,
                            Align      = TextAnchor.MiddleCenter,
                            Command    = "mrap.customamount",
                            Color      = ColText,
                            CharsLimit = 6
                        },
                        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                    }
                });

                inputBaseY -= 0.085f;
            }

            // "Giving N×" summary
            int resolved = ResolvedAmount(s);
            ui.Add(new CuiLabel
            {
                Text          =
                {
                    Text     = $"Giving  {resolved:N0} ×",
                    FontSize = 10,
                    Align    = TextAnchor.MiddleRight,
                    Color    = ColTextMuted,
                    Font     = "robotocondensed-regular.ttf"
                },
                RectTransform = { AnchorMin = $"0.04 {inputBaseY - 0.042f:F3}", AnchorMax = $"0.96 {inputBaseY:F3}" }
            }, UiGive);

            // ── GIVE button ───────────────────────────────────────────
            bool canGive = s.TargetId != 0;
            ui.Add(new CuiButton
            {
                Button        =
                {
                    Command = canGive ? "mrap.give" : "",
                    Color   = canGive ? ColOrange : ColGiveBtnOff
                },
                RectTransform = { AnchorMin = "0.04 0.025", AnchorMax = "0.96 0.105" },
                Text          =
                {
                    Text     = canGive ? $"Give  {resolved:N0} ×" : "Select a player first",
                    FontSize = 13,
                    Align    = TextAnchor.MiddleCenter,
                    Color    = canGive ? "1 1 1 1" : ColTextDim,
                    Font     = "robotocondensed-bold.ttf"
                }
            }, UiGive);
        }

        // ─────────────────────────────────────────────────────────────
        //  Helpers
        // ─────────────────────────────────────────────────────────────

        private static List<string> ItemsFor(string category)
        {
            if (category == "All")
                return Categories.Values.SelectMany(x => x).ToList();
            return Categories.TryGetValue(category, out var list) ? list : new List<string>();
        }

        private static int ResolvedAmount(PlayerState s)
        {
            switch (s.AmountMode)
            {
                case "100":    return 100;
                case "1000":   return 1000;
                case "stack":  return Math.Max(1, s.SelectedStack);
                case "custom": return Math.Max(1, s.CustomAmount);
                default:       return 100;
            }
        }
    }
}
