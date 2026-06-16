using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconStructureIQ", "MyRcon", "1.0.0")]
    [Description("PvE server structure analytics and base intelligence for MyRCON")]
    public class MyRconStructureIQ : RustPlugin
    {
        // ── Permissions ───────────────────────────────────────────────────────
        const string PermAdmin   = "myrconstructureiq.admin";
        const string PermScan    = "myrconstructureiq.scan";
        const string PermView    = "myrconstructureiq.view";
        const string PermProtect = "myrconstructureiq.protect";
        const string PermIgnore  = "myrconstructureiq.ignore";
        const string PermNotes   = "myrconstructureiq.notes";
        const string PermLimits  = "myrconstructureiq.limits";

        // ── Config ────────────────────────────────────────────────────────────
        PluginConfig _cfg;

        class PluginConfig
        {
            public bool  EnablePlugin          = true;
            public bool  EnableAutoScan        = false;
            public int   ScanIntervalMinutes   = 120;
            public float ScanRadius            = 100f;
            public bool  ProtectAdmins         = true;
            public bool  IncludeVehiclesNearby = true;
            public bool  IncludeDeployables    = true;
            public bool  IncludeElectrical     = true;
            public bool  IncludeIndustrial     = true;
            public bool  IncludeSigns          = true;
            public bool  IncludeTurrets        = true;
            // Size thresholds (total entity count)
            public int   TinyMax    = 20;
            public int   SmallMax   = 75;
            public int   MediumMax  = 200;
            public int   LargeMax   = 500;
            public int   MassiveMax = 1000;
            // Rule limits — warning / severe
            public int   MaxBlocksWarning      = 500;
            public int   MaxBlocksSevere       = 1500;
            public int   MaxEntitiesWarning    = 300;
            public int   MaxEntitiesSevere     = 1000;
            public int   MaxTurretsWarning     = 5;
            public int   MaxTurretsSevere      = 15;
            public int   MaxTCsWarning         = 3;
            public int   MaxTCsSevere          = 8;
            public int   MaxVendingWarning     = 3;
            public int   MaxVendingSevere      = 8;
            public int   MaxSignsWarning       = 10;
            public int   MaxSignsSevere        = 30;
            public int   MaxElectricalWarning  = 20;
            public int   MaxElectricalSevere   = 60;
            // Score thresholds
            public int   PerformanceWarningScore = 40;
            public int   PerformanceHighScore    = 70;
            public bool  DebugLogging            = false;
        }

        // ── Data model ────────────────────────────────────────────────────────
        SIQData _data;
        const string DataFile = "MyRconStructureIQ";

        class SIQData
        {
            public Dictionary<string, StructureEntry> Structures     = new Dictionary<string, StructureEntry>();
            public Dictionary<string, long>           PlayerLastSeen = new Dictionary<string, long>();
            public HashSet<string>                    Protected      = new HashSet<string>();
            public HashSet<string>                    Ignored        = new HashSet<string>();
            public Dictionary<string, string>         Notes          = new Dictionary<string, string>();
            public ScanSummary                        LastScan       = null;
            public string                             LastScanTime   = null;
        }

        class StructureEntry
        {
            public string       Id;
            public string       Name;
            public string       OwnerSteamId;
            public string       OwnerName;
            public List<string> AuthorizedPlayers   = new List<string>();
            public string       OwnershipConfidence;
            public string       Grid;
            public float        X, Y, Z;
            public int          BlockCount;
            public int          EntityCount;
            public int          DoorCount;
            public int          ContainerCount;
            public int          TurretCount;
            public int          TrapCount;
            public int          FurnaceCount;
            public int          WorkbenchCount;
            public int          VendingMachineCount;
            public int          SignCount;
            public int          ElectricalCount;
            public int          IndustrialCount;
            public int          DeployableCount;
            public int          TCCount;
            public int          VehicleNearbyCount;
            public int          PerformanceScore;
            public string       SizeClass;
            public string       RuleStatus;
            public string       LastActive;
            public bool         IsProtected;
            public bool         IsIgnored;
            public string       AdminNote;
            public bool         UpkeepEmpty;
        }

        class ScanSummary
        {
            public int TotalStructures  = 0;
            public int MassiveBuilds    = 0;
            public int HighImpact       = 0;
            public int OverLimit        = 0;
            public int ProtectedCount   = 0;
            public int UnknownOwnership = 0;
            public int TotalEntities    = 0;
        }

        // ── Runtime ───────────────────────────────────────────────────────────
        bool _isScanning = false;
        readonly Dictionary<ulong, long> _entityLastInteraction = new Dictionary<ulong, long>();

        // ── Init / lifecycle ──────────────────────────────────────────────────
        void Init()
        {
            permission.RegisterPermission(PermAdmin,   this);
            permission.RegisterPermission(PermScan,    this);
            permission.RegisterPermission(PermView,    this);
            permission.RegisterPermission(PermProtect, this);
            permission.RegisterPermission(PermIgnore,  this);
            permission.RegisterPermission(PermNotes,   this);
            permission.RegisterPermission(PermLimits,  this);
            LoadData();
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try   { _cfg = Config.ReadObject<PluginConfig>(); if (_cfg == null) throw new Exception(); }
            catch { _cfg = new PluginConfig(); SaveConfig(); }
        }
        protected override void SaveConfig()        => Config.WriteObject(_cfg, true);
        protected override void LoadDefaultConfig() { _cfg = new PluginConfig(); }

        void OnServerInitialized()
        {
            if (!_cfg.EnablePlugin) return;
            if (_cfg.EnableAutoScan && _cfg.ScanIntervalMinutes > 0)
                timer.Every(_cfg.ScanIntervalMinutes * 60f, () => RunScan(null, auto: true));
        }

        void Unload() => SaveData();

        void LoadData()
        {
            try   { _data = Interface.Oxide.DataFileSystem.ReadObject<SIQData>(DataFile) ?? new SIQData(); }
            catch { _data = new SIQData(); }
            if (_data.Structures     == null) _data.Structures     = new Dictionary<string, StructureEntry>();
            if (_data.PlayerLastSeen == null) _data.PlayerLastSeen = new Dictionary<string, long>();
            if (_data.Protected      == null) _data.Protected      = new HashSet<string>();
            if (_data.Ignored        == null) _data.Ignored        = new HashSet<string>();
            if (_data.Notes          == null) _data.Notes          = new Dictionary<string, string>();
        }

        void SaveData() => Interface.Oxide.DataFileSystem.WriteObject(DataFile, _data);

        // ── Interaction tracking hooks ─────────────────────────────────────────
        void OnPlayerConnected(BasePlayer player)
        {
            _data.PlayerLastSeen[player.UserIDString] = UnixNow();
            SaveData();
        }

        void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            _data.PlayerLastSeen[player.UserIDString] = UnixNow();
            SaveData();
        }

        void OnLootEntity(BasePlayer player, BaseEntity entity)
        {
            if (entity?.net == null) return;
            _entityLastInteraction[entity.net.ID.Value] = UnixNow();
        }

        void OnDoorOpened(Door door, BasePlayer player)
        {
            if (door?.net == null) return;
            _entityLastInteraction[door.net.ID.Value] = UnixNow();
        }

        object CanMountEntity(BasePlayer player, BaseMountable entity)
        {
            if (entity?.net == null) return null;
            _entityLastInteraction[entity.net.ID.Value] = UnixNow();
            return null;
        }

        // ── Scan ──────────────────────────────────────────────────────────────
        void RunScan(BasePlayer invoker, bool auto = false)
        {
            if (_isScanning)
            {
                if (invoker != null) SendReply(invoker, Prefix("Scan already in progress."));
                return;
            }
            _isScanning = true;
            if (invoker != null) SendReply(invoker, Prefix("Scanning structures..."));

            try
            {
                long now = UnixNow();

                // Single pass — collect TCs and all other entities separately
                var tcEntities    = new List<BaseEntity>();
                var otherEntities = new List<BaseEntity>();

                foreach (BaseNetworkable net in BaseNetworkable.serverEntities)
                {
                    if (net == null || net.IsDestroyed) continue;
                    var entity = net as BaseEntity;
                    if (entity == null) continue;

                    if (entity.ShortPrefabName == "cupboard.tool.deployed")
                        tcEntities.Add(entity);
                    else
                        otherEntities.Add(entity);
                }

                var structures = new Dictionary<string, StructureEntry>();
                var summary    = new ScanSummary();

                foreach (var tc in tcEntities)
                {
                    if (tc == null || tc.IsDestroyed) continue;
                    var entry = BuildStructureEntry(tc, otherEntities, now);
                    if (entry == null) continue;

                    // Merge persisted admin data
                    entry.IsProtected = _data.Protected.Contains(entry.Id);
                    entry.IsIgnored   = _data.Ignored.Contains(entry.Id);
                    _data.Notes.TryGetValue(entry.Id, out entry.AdminNote);
                    StructureEntry old;
                    if (_data.Structures.TryGetValue(entry.Id, out old)) entry.Name = old.Name;

                    structures[entry.Id] = entry;

                    summary.TotalStructures++;
                    summary.TotalEntities += entry.EntityCount;
                    if (entry.SizeClass == "Massive" || entry.SizeClass == "Extreme") summary.MassiveBuilds++;
                    if (entry.PerformanceScore >= _cfg.PerformanceHighScore)           summary.HighImpact++;
                    if (entry.RuleStatus == "Warning" || entry.RuleStatus == "Severe") summary.OverLimit++;
                    if (entry.IsProtected)                                             summary.ProtectedCount++;
                    if (entry.OwnershipConfidence == "Unknown")                        summary.UnknownOwnership++;
                }

                _data.Structures   = structures;
                _data.LastScan     = summary;
                _data.LastScanTime = DateTime.UtcNow.ToString("o");
                SaveData();

                if (invoker != null)
                    SendReply(invoker, Prefix(string.Format(
                        "Done. Structures: {0} | High Impact: {1} | Over Limit: {2} | Massive: {3}",
                        summary.TotalStructures, summary.HighImpact, summary.OverLimit, summary.MassiveBuilds)));
            }
            finally { _isScanning = false; }
        }

        StructureEntry BuildStructureEntry(BaseEntity tc, List<BaseEntity> others, long now)
        {
            if (tc?.net == null) return null;

            string netId = tc.net.ID.Value.ToString();
            ulong  owner = tc.OwnerID;
            var    pos   = tc.transform.position;

            // Building block count via reflection (same pattern as Reclaim)
            int blockCount = 0;
            try
            {
                var building = ReflInvoke(tc, "GetBuilding");
                if (building != null)
                {
                    var blocks = ReflGet(building, "buildingBlocks") as System.Collections.IEnumerable;
                    if (blocks != null) foreach (var _ in blocks) blockCount++;
                }
            }
            catch { }

            // Authorized players via reflection
            var authPlayers = new List<string>();
            try
            {
                var auth = ReflGet(tc, "authorizedPlayers") as System.Collections.IEnumerable;
                if (auth != null)
                    foreach (var a in auth)
                    {
                        var uid = ReflGet(a, "userid");
                        if (uid != null) authPlayers.Add(((ulong)uid).ToString());
                    }
            }
            catch { }

            // TC upkeep status
            bool upkeepEmpty = true;
            try
            {
                var sc = tc as StorageContainer;
                upkeepEmpty = sc?.inventory == null || sc.inventory.itemList.Count == 0;
            }
            catch { }

            // Radius scan of pre-collected entities
            float radius = _cfg.ScanRadius;
            int doors = 0, containers = 0, turrets = 0, traps = 0;
            int furnaces = 0, workbenches = 0, vending = 0, signs = 0;
            int electrical = 0, industrial = 0, deployables = 0, vehicles = 0, extraTCs = 0;
            long lastActive = 0;

            foreach (var entity in others)
            {
                if (entity == null || entity.IsDestroyed) continue;
                if (Vector3.Distance(pos, entity.transform.position) > radius) continue;

                // Track last interaction
                if (entity.net != null)
                {
                    long touch;
                    if (_entityLastInteraction.TryGetValue(entity.net.ID.Value, out touch))
                        if (touch > lastActive) lastActive = touch;
                }

                string p = entity.ShortPrefabName ?? "";

                if (p == "cupboard.tool.deployed")    { extraTCs++;                    continue; }
                if (entity is Door)                   { doors++;      deployables++;   continue; }
                if (IsContainer(entity, p))            { containers++; deployables++;   continue; }
                if (p.StartsWith("workbench"))         { workbenches++;deployables++;   continue; }
                if (IsFurnace(entity, p))              { furnaces++;   deployables++;   continue; }
                if (IsTurret(entity, p))               { turrets++;    deployables++;   continue; }
                if (entity is BaseTrap)               { traps++;      deployables++;   continue; }
                if (_cfg.IncludeSigns    && IsSign(entity))    { signs++;      deployables++;   continue; }
                if (IsVending(entity))                 { vending++;    deployables++;   continue; }
                if (_cfg.IncludeElectrical && IsElectrical(p)) { electrical++;  deployables++;   continue; }
                if (_cfg.IncludeIndustrial && IsIndustrial(p)) { industrial++;  deployables++;   continue; }
                if (_cfg.IncludeVehiclesNearby && entity is BaseVehicle) { vehicles++; continue; }
                if (_cfg.IncludeDeployables && entity.OwnerID != 0 && !(entity is BuildingBlock))
                    deployables++;
            }

            // Last active: max of entity touches, owner last seen, TC touch
            long ownerSeen;
            if (!_data.PlayerLastSeen.TryGetValue(owner.ToString(), out ownerSeen)) ownerSeen = 0;
            if (ownerSeen > lastActive) lastActive = ownerSeen;
            long tcTouch;
            if (tc.net != null && _entityLastInteraction.TryGetValue(tc.net.ID.Value, out tcTouch))
                if (tcTouch > lastActive) lastActive = tcTouch;

            int totalEntities = blockCount + deployables + vehicles;

            var entry = new StructureEntry
            {
                Id                  = netId,
                OwnerSteamId        = owner.ToString(),
                OwnerName           = GetPlayerName(owner),
                AuthorizedPlayers   = authPlayers,
                OwnershipConfidence = DetermineConfidence(owner, authPlayers),
                Grid                = GetGrid(pos),
                X = pos.x, Y = pos.y, Z = pos.z,
                BlockCount          = blockCount,
                EntityCount         = totalEntities,
                DoorCount           = doors,
                ContainerCount      = containers,
                TurretCount         = turrets,
                TrapCount           = traps,
                FurnaceCount        = furnaces,
                WorkbenchCount      = workbenches,
                VendingMachineCount = vending,
                SignCount           = signs,
                ElectricalCount     = electrical,
                IndustrialCount     = industrial,
                DeployableCount     = deployables,
                TCCount             = 1 + extraTCs,
                VehicleNearbyCount  = vehicles,
                UpkeepEmpty         = upkeepEmpty,
                LastActive          = lastActive > 0 ? UnixToIso(lastActive) : null,
            };

            entry.SizeClass        = ClassifySize(entry.EntityCount);
            entry.PerformanceScore = CalcScore(entry);
            entry.RuleStatus       = CalcRuleStatus(entry);
            return entry;
        }

        // ── Entity category helpers (prefab-name based for Carbon 2.0 safety) ─
        bool IsContainer(BaseEntity e, string p) =>
            e is StorageContainer &&
            p != "cupboard.tool.deployed" &&
            !p.StartsWith("workbench") &&
            !p.Contains("vendingmachine") &&
            !p.Contains("autoturret") &&
            !p.Contains("sam_site");

        bool IsFurnace(BaseEntity e, string p) =>
            e is BaseOven &&
            !p.Contains("campfire") && !p.Contains("bbq") && !p.Contains("skull_fire_pit");

        bool IsTurret(BaseEntity e, string p) =>
            e is AutoTurret || p.Contains("sam_site_turret");

        bool IsSign(BaseEntity e) => e is Signage;

        bool IsVending(BaseEntity e) => e is VendingMachine;

        bool IsElectrical(string p) =>
            p.StartsWith("electric.") || p.Contains("rfbroadcaster") || p.Contains("rfreceiver") ||
            p.Contains("pressurepad") || p.Contains("smartswitch") || p.Contains("timerswitch") ||
            p.Contains("counter.") || p.Contains("poweredwaterpurifier") || p.Contains("doorcontroller") ||
            p.Contains("largerechargebattery") || p.Contains("smallrechargablebattery") ||
            p.Contains("solarpanel") || p.Contains("flasherlight") || p.Contains("sirenlight");

        bool IsIndustrial(string p) =>
            p.Contains("industrial.") || p.Contains("stonecutter") ||
            p.Contains("modularcarlift") || p.Contains("mixingtable");

        // ── Classification and scoring ─────────────────────────────────────────
        string DetermineConfidence(ulong ownerId, List<string> auth)
        {
            if (ownerId == 0) return "Unknown";
            if (auth.Count == 0 || auth.Contains(ownerId.ToString())) return "High";
            return "Medium";
        }

        string ClassifySize(int count)
        {
            if (count <= _cfg.TinyMax)    return "Tiny";
            if (count <= _cfg.SmallMax)   return "Small";
            if (count <= _cfg.MediumMax)  return "Medium";
            if (count <= _cfg.LargeMax)   return "Large";
            if (count <= _cfg.MassiveMax) return "Massive";
            return "Extreme";
        }

        int CalcScore(StructureEntry e)
        {
            float s = 0;
            s += Math.Min(e.EntityCount  / 20f  * 30f, 30f);
            s += Math.Min(e.TurretCount  * 4f,         20f);
            s += Math.Min(e.ElectricalCount * 0.5f,    10f);
            s += Math.Min(e.IndustrialCount * 1f,      10f);
            s += Math.Min(e.SignCount    * 0.5f,         5f);
            s += Math.Min(e.VendingMachineCount * 2f,  10f);
            s += Math.Min(e.VehicleNearbyCount  * 1f,   5f);
            if (e.UpkeepEmpty) s += 5;
            return Math.Min((int)s, 100);
        }

        string CalcRuleStatus(StructureEntry e)
        {
            if (e.BlockCount >= _cfg.MaxBlocksSevere      || e.EntityCount >= _cfg.MaxEntitiesSevere  ||
                e.TurretCount >= _cfg.MaxTurretsSevere    || e.TCCount >= _cfg.MaxTCsSevere           ||
                e.VendingMachineCount >= _cfg.MaxVendingSevere  ||
                e.SignCount >= _cfg.MaxSignsSevere         || e.ElectricalCount >= _cfg.MaxElectricalSevere)
                return "Severe";

            if (e.BlockCount >= _cfg.MaxBlocksWarning     || e.EntityCount >= _cfg.MaxEntitiesWarning  ||
                e.TurretCount >= _cfg.MaxTurretsWarning   || e.TCCount >= _cfg.MaxTCsWarning           ||
                e.VendingMachineCount >= _cfg.MaxVendingWarning ||
                e.SignCount >= _cfg.MaxSignsWarning        || e.ElectricalCount >= _cfg.MaxElectricalWarning)
                return "Warning";

            return "OK";
        }

        // ── Console commands (MyRCON panel integration) ───────────────────────
        [ConsoleCommand("siq.getsummary")]
        void ConsoleSummary(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                isScanning   = _isScanning,
                hasScanData  = _data.LastScanTime != null,
                lastScanTime = _data.LastScanTime,
                stats        = _data.LastScan,
            }));
        }

        [ConsoleCommand("siq.getstructures")]
        void ConsoleGetStructures(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var args = arg.Args ?? new string[0];
            int page    = args.Length > 0 ? ParseInt(args[0], 0) : 0;
            int size    = args.Length > 1 ? ParseInt(args[1], 100) : 100;
            string sort = args.Length > 2 ? args[2].ToLower() : "score";

            var list = _data.Structures.Values.AsEnumerable();

            switch (sort)
            {
                case "entities": list = list.OrderByDescending(s => s.EntityCount); break;
                case "blocks":   list = list.OrderByDescending(s => s.BlockCount);  break;
                case "owner":    list = list.OrderBy(s => s.OwnerName);             break;
                case "grid":     list = list.OrderBy(s => s.Grid);                  break;
                case "active":   list = list.OrderByDescending(s => s.LastActive);  break;
                case "rule":     list = list.OrderByDescending(s => RuleOrder(s.RuleStatus)); break;
                default:         list = list.OrderByDescending(s => s.PerformanceScore); break;
            }

            var all   = list.ToList();
            var items = all.Skip(page * size).Take(size).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = all.Count, page, pageSize = size, items }));
        }

        [ConsoleCommand("siq.getstructure")]
        void ConsoleGetStructure(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            StructureEntry entry;
            if (!_data.Structures.TryGetValue(id, out entry)) { arg.ReplyWith(Err("Not found")); return; }
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, entry }));
        }

        [ConsoleCommand("siq.getowners")]
        void ConsoleGetOwners(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var args = arg.Args ?? new string[0];
            int page = args.Length > 0 ? ParseInt(args[0], 0) : 0;
            int size = args.Length > 1 ? ParseInt(args[1], 50) : 50;

            var owners = _data.Structures.Values
                .GroupBy(s => s.OwnerSteamId)
                .Select(g => new {
                    ownerSteamId    = g.Key,
                    ownerName       = g.First().OwnerName,
                    structureCount  = g.Count(),
                    totalEntities   = g.Sum(s => s.EntityCount),
                    totalBlocks     = g.Sum(s => s.BlockCount),
                    totalTurrets    = g.Sum(s => s.TurretCount),
                    totalDeployables = g.Sum(s => s.DeployableCount),
                    highestScore    = g.Max(s => s.PerformanceScore),
                    hasWarning      = g.Any(s => s.RuleStatus != "OK"),
                })
                .OrderByDescending(o => o.totalEntities)
                .ToList();

            arg.ReplyWith(JsonConvert.SerializeObject(new {
                total = owners.Count, page, pageSize = size,
                items = owners.Skip(page * size).Take(size).ToList(),
            }));
        }

        [ConsoleCommand("siq.gethotspots")]
        void ConsoleGetHotspots(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var hotspots = _data.Structures.Values
                .GroupBy(s => s.Grid)
                .Select(g => {
                    int total = g.Sum(s => s.EntityCount);
                    return new {
                        grid            = g.Key,
                        structureCount  = g.Count(),
                        totalEntities   = total,
                        highestScore    = g.Max(s => s.PerformanceScore),
                        concern         = total > 2000 ? "Critical" : total > 1000 ? "High" : total > 500 ? "Medium" : "Low",
                        owners          = g.Select(s => s.OwnerName).Distinct().Take(5).ToList(),
                    };
                })
                .OrderByDescending(h => h.totalEntities)
                .Take(25)
                .ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { hotspots }));
        }

        [ConsoleCommand("siq.getlimits")]
        void ConsoleGetLimits(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var args = arg.Args ?? new string[0];
            int page = args.Length > 0 ? ParseInt(args[0], 0) : 0;
            int size = args.Length > 1 ? ParseInt(args[1], 50) : 50;
            var flagged = _data.Structures.Values
                .Where(s => s.RuleStatus != "OK")
                .OrderByDescending(s => RuleOrder(s.RuleStatus))
                .ThenByDescending(s => s.EntityCount)
                .ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                total = flagged.Count, page, pageSize = size,
                items = flagged.Skip(page * size).Take(size).ToList(),
            }));
        }

        [ConsoleCommand("siq.getprotected")]
        void ConsoleGetProtected(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var items = _data.Structures.Values
                .Where(s => s.IsProtected || s.IsIgnored)
                .OrderBy(s => s.IsProtected ? 0 : 1).ThenBy(s => s.OwnerName)
                .ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { items }));
        }

        [ConsoleCommand("siq.getnotes")]
        void ConsoleGetNotes(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var notes = _data.Notes.Select(kvp => {
                StructureEntry s;
                _data.Structures.TryGetValue(kvp.Key, out s);
                return new { id = kvp.Key, note = kvp.Value, owner = s?.OwnerName ?? "?", grid = s?.Grid ?? "?" };
            }).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { notes }));
        }

        [ConsoleCommand("siq.scan")]
        void ConsoleScan(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (_isScanning) { arg.ReplyWith(JsonConvert.SerializeObject(new { success = false, message = "Scan already in progress" })); return; }
            timer.Once(0.1f, () => RunScan(null));
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, message = "Scan started" }));
        }

        [ConsoleCommand("siq.protect")]
        void ConsoleProtect(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            _data.Protected.Add(id); _data.Ignored.Remove(id);
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) { s.IsProtected = true; s.IsIgnored = false; }
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "protected", id }));
        }

        [ConsoleCommand("siq.unprotect")]
        void ConsoleUnprotect(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            _data.Protected.Remove(id);
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) s.IsProtected = false;
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "unprotected", id }));
        }

        [ConsoleCommand("siq.ignore")]
        void ConsoleIgnore(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            _data.Ignored.Add(id); _data.Protected.Remove(id);
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) { s.IsIgnored = true; s.IsProtected = false; }
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "ignored", id }));
        }

        [ConsoleCommand("siq.unignore")]
        void ConsoleUnignore(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            _data.Ignored.Remove(id);
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) s.IsIgnored = false;
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "unignored", id }));
        }

        [ConsoleCommand("siq.note")]
        void ConsoleNote(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var args = arg.Args ?? new string[0];
            if (args.Length < 2) { arg.ReplyWith(Err("id and message required")); return; }
            string id      = args[0];
            string message = string.Join(" ", args.Skip(1));
            _data.Notes[id] = message;
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) s.AdminNote = message;
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "note", id, message }));
        }

        [ConsoleCommand("siq.deletenote")]
        void ConsoleDeleteNote(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            _data.Notes.Remove(id);
            StructureEntry s; if (_data.Structures.TryGetValue(id, out s)) s.AdminNote = null;
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "deletenote", id }));
        }

        [ConsoleCommand("siq.refresh")]
        void ConsoleRefresh(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("id required")); return; }
            string id = arg.GetString(0);
            ulong netId; if (!ulong.TryParse(id, out netId)) { arg.ReplyWith(Err("Invalid id")); return; }

            BaseEntity tc = null;
            foreach (BaseNetworkable net in BaseNetworkable.serverEntities)
            {
                if (net?.net != null && net.net.ID.Value == netId && (net as BaseEntity)?.ShortPrefabName == "cupboard.tool.deployed")
                { tc = net as BaseEntity; break; }
            }
            if (tc == null || tc.IsDestroyed) { arg.ReplyWith(Err("TC not found in world")); return; }

            var others = new List<BaseEntity>();
            foreach (BaseNetworkable net in BaseNetworkable.serverEntities)
            {
                if (net == null || net.IsDestroyed) continue;
                var e = net as BaseEntity;
                if (e != null && e.ShortPrefabName != "cupboard.tool.deployed") others.Add(e);
            }

            var entry = BuildStructureEntry(tc, others, UnixNow());
            if (entry == null) { arg.ReplyWith(Err("Analysis failed")); return; }

            entry.IsProtected = _data.Protected.Contains(id);
            entry.IsIgnored   = _data.Ignored.Contains(id);
            _data.Notes.TryGetValue(id, out entry.AdminNote);
            StructureEntry old; if (_data.Structures.TryGetValue(id, out old)) entry.Name = old.Name;

            _data.Structures[id] = entry;
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, entry }));
        }

        // ── Chat commands ─────────────────────────────────────────────────────
        [ChatCommand("structureiq")]
        void CmdStructureIQ(BasePlayer player, string cmd, string[] args)
        {
            bool isAdmin = permission.UserHasPermission(player.UserIDString, PermAdmin);
            bool canScan = permission.UserHasPermission(player.UserIDString, PermScan) || isAdmin;
            bool canView = permission.UserHasPermission(player.UserIDString, PermView)  || isAdmin;
            if (!canScan && !canView) { SendReply(player, Prefix("You do not have permission.")); return; }

            string sub = args.Length > 0 ? args[0].ToLower() : "help";
            switch (sub)
            {
                case "scan":
                    if (!canScan) { SendReply(player, Prefix("No scan permission.")); return; }
                    if (_isScanning) { SendReply(player, Prefix("Scan already in progress.")); return; }
                    timer.Once(0.1f, () => RunScan(player));
                    break;
                case "stats":
                    if (_data.LastScan == null) { SendReply(player, Prefix("No data. Run /structureiq scan first.")); return; }
                    var st = _data.LastScan;
                    SendReply(player, string.Format("{0}\nStructures: {1}  |  Massive: {2}  |  High Impact: {3}\nOver Limit: {4}  |  Protected: {5}  |  Unknown Owner: {6}",
                        Prefix("StructureIQ Summary"), st.TotalStructures, st.MassiveBuilds, st.HighImpact,
                        st.OverLimit, st.ProtectedCount, st.UnknownOwnership));
                    break;
                case "limits":
                    if (!canView) { SendReply(player, Prefix("No permission.")); return; }
                    var over = _data.Structures.Values.Where(e => e.RuleStatus != "OK").Take(5).ToList();
                    if (over.Count == 0) { SendReply(player, Prefix("No structures exceed configured limits.")); return; }
                    foreach (var e in over)
                        SendReply(player, string.Format("  [{0}] {1} — {2} ents — {3}", e.Grid, e.OwnerName, e.EntityCount, e.RuleStatus));
                    break;
                default:
                    SendReply(player, string.Format("{0}\n/structureiq scan — Run scan\n/structureiq stats — Summary\n/structureiq limits — Over-limit structures", Prefix("Commands:")));
                    break;
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        static object ReflGet(object obj, string name)
        {
            if (obj == null) return null;
            var t = obj.GetType();
            var p = t.GetProperty(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
            if (p != null) return p.GetValue(obj);
            var f = t.GetField(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
            return f?.GetValue(obj);
        }

        static object ReflInvoke(object obj, string method, params object[] methodArgs)
        {
            if (obj == null) return null;
            var m = obj.GetType().GetMethod(method, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
            return m?.Invoke(obj, methodArgs);
        }

        string GetPlayerName(ulong id)
        {
            if (id == 0) return "Unknown";
            var p = BasePlayer.FindByID(id) ?? BasePlayer.FindSleeping(id);
            if (p != null) return p.displayName;
            var u = ServerUsers.Get(id);
            return u?.username ?? id.ToString();
        }

        string GetGrid(Vector3 pos)
        {
            float mapSize = TerrainMeta.Size.x;
            if (mapSize <= 0) return "?";
            float gridSize = 146.3f;
            int col = Mathf.FloorToInt((pos.x + mapSize / 2f) / gridSize);
            int row = Mathf.FloorToInt((mapSize / 2f - pos.z) / gridSize);
            string colStr = "";
            int tmp = col;
            do { colStr = ((char)('A' + (tmp % 26))).ToString() + colStr; tmp = tmp / 26 - 1; } while (tmp >= 0);
            return colStr + (row + 1);
        }

        bool IsRconOrAdmin(ConsoleSystem.Arg arg)
        {
            if (arg.IsRcon) return true;
            var p = arg.Player();
            return p != null && (p.IsAdmin || permission.UserHasPermission(p.UserIDString, PermAdmin));
        }

        static int    ParseInt(string s, int def)  { int v; return int.TryParse(s, out v) ? v : def; }
        static int    RuleOrder(string r)           => r == "Severe" ? 2 : r == "Warning" ? 1 : 0;
        static long   UnixNow()                     => (long)(DateTime.UtcNow - new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalSeconds;
        static string UnixToIso(long ts)            => new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc).AddSeconds(ts).ToString("o");
        static string Prefix(string msg)            => string.Format("<color=#4A9ECC>MyRcon StructureIQ</color>: {0}", msg);
        static string Err(string msg)               => string.Format("{{\"error\":\"{0}\"}}", msg);
    }
}
