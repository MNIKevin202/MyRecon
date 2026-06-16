using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("MyRconReclaim", "MyRcon", "1.0.1")]
    [Description("PvE server cleanup and abandoned asset management for MyRCON")]
    public class MyRconReclaim : RustPlugin
    {
        // ── Permissions ───────────────────────────────────────────────────────
        private const string PermAdmin       = "myrconreclaim.admin";
        private const string PermScan        = "myrconreclaim.scan";
        private const string PermInspect     = "myrconreclaim.inspect";
        private const string PermDelete      = "myrconreclaim.delete";
        private const string PermProtect     = "myrconreclaim.protect";
        private const string PermIgnore      = "myrconreclaim.ignore";
        private const string PermAutoCleanup = "myrconreclaim.autocleanup";

        // ── Config ────────────────────────────────────────────────────────────
        private PluginConfig _cfg;

        private class PluginConfig
        {
            public bool   EnablePlugin                  = true;
            public bool   EnableAutoCleanup             = false;
            public int    ScanIntervalMinutes           = 60;
            public int    AbandonedBaseDays             = 14;
            public int    VehicleInactiveDays           = 7;
            public int    DeployableInactiveDays        = 14;
            public bool   ProtectPlayersWithRecentLogin = true;
            public int    RecentLoginDays               = 3;
            public bool   ProtectAdmins                 = true;
            public bool   RequireConfirmationForDelete  = true;
            public bool   AllowBulkDelete               = false;
            public int    MaxEntitiesDeletedPerRun      = 50;
            public bool   CleanupWarningEnabled         = true;
            public int    CleanupWarningDays            = 3;
            public bool   DebugLogging                  = false;
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try   { _cfg = Config.ReadObject<PluginConfig>(); if (_cfg == null) throw new Exception(); }
            catch { _cfg = new PluginConfig(); SaveConfig(); }
        }
        protected override void SaveConfig()        => Config.WriteObject(_cfg, true);
        protected override void LoadDefaultConfig() { _cfg = new PluginConfig(); }

        // ── Persisted data ────────────────────────────────────────────────────
        private ReclaimData _data;
        private const string DataFile = "MyRconReclaim";

        private class ReclaimData
        {
            public Dictionary<string, long> PlayerLastSeen = new Dictionary<string, long>();
            public HashSet<string>          Protected      = new HashSet<string>();
            public HashSet<string>          Ignored        = new HashSet<string>();
            public List<CleanupEntry>       History        = new List<CleanupEntry>();
            public List<WarningRecord>      Warnings       = new List<WarningRecord>();
            public ScanSummary              LastScan       = null;
            public string                   LastScanTime   = null;
        }

        private class ScanSummary
        {
            public int TotalBases           = 0;
            public int AbandonedBases       = 0;
            public int CleanupReadyBases    = 0;
            public int ProtectedCount       = 0;
            public int TotalVehicles        = 0;
            public int UnusedVehicles       = 0;
            public int TotalDeployables     = 0;
            public int AbandonedDeployables = 0;
            public int EstimatedEntities    = 0;
        }

        private class CleanupEntry
        {
            public string Admin;
            public string EntityType;
            public string OwnerName;
            public string OwnerId;
            public string Grid;
            public string Position;
            public int    EntityCount;
            public string Reason;
            public string Time;
            public bool   Automatic;
        }

        private class WarningRecord
        {
            public string PlayerId;
            public string PlayerName;
            public string Message;
            public string IssuedTime;
            public bool   Delivered;
        }

        // ── Scan result types ─────────────────────────────────────────────────
        private class BaseEntry
        {
            public string Id;
            public string OwnerSteamId;
            public string OwnerName;
            public string Status;
            public string Risk;
            public string LastActivity;
            public int    EntityCount;
            public string Grid;
            public float  X, Y, Z;
            public bool   UpkeepEmpty;
            public string FlagReason;
            public bool   IsProtected;
            public bool   IsIgnored;
        }

        private class VehicleEntry
        {
            public string Id;
            public string EntityType;
            public string OwnerSteamId;
            public string OwnerName;
            public string Status;
            public string Risk;
            public string LastUsed;
            public string Grid;
            public float  X, Y, Z;
            public float  HealthPercent;
            public bool   IsDecaying;
            public bool   IsProtected;
            public bool   IsIgnored;
        }

        private class DeployableEntry
        {
            public string Id;
            public string EntityType;
            public string OwnerSteamId;
            public string OwnerName;
            public string Status;
            public string Risk;
            public string LastInteraction;
            public string Grid;
            public float  X, Y, Z;
            public bool   HasTCCoverage;
            public bool   IsProtected;
            public bool   IsIgnored;
        }

        // ── Runtime state ─────────────────────────────────────────────────────
        private bool _isScanning = false;
        private readonly Dictionary<uint, long> _entityLastInteraction = new Dictionary<uint, long>();
        private List<BaseEntry>       _cachedBases       = new List<BaseEntry>();
        private List<VehicleEntry>    _cachedVehicles    = new List<VehicleEntry>();
        private List<DeployableEntry> _cachedDeployables = new List<DeployableEntry>();

        // Vehicle prefab name fragments
        private static readonly string[] VehicleParts = {
            "minicopter", "scraptransporthelicopter", "rowboat", "rhib",
            "tugboat", "snowmobile", "tomahasnowmobile", "ridablehorse",
            "hotairballoon", "kayak", "submarinesolo", "submarineduo",
        };

        // Deployable prefab name fragments
        private static readonly string[] DeployableParts = {
            "furnace", "refinery_small", "box.wooden", "woodbox",
            "sleepingbag", "bed_deployed", "autoturret", "sam_site",
            "workbench1", "workbench2", "workbench3",
            "vendingmachine", "campfire", "bbq", "sign.", "skull_fire_pit",
        };

        // ── Init ──────────────────────────────────────────────────────────────
        void Init()
        {
            permission.RegisterPermission(PermAdmin,       this);
            permission.RegisterPermission(PermScan,        this);
            permission.RegisterPermission(PermInspect,     this);
            permission.RegisterPermission(PermDelete,      this);
            permission.RegisterPermission(PermProtect,     this);
            permission.RegisterPermission(PermIgnore,      this);
            permission.RegisterPermission(PermAutoCleanup, this);
            LoadData();
        }

        void OnServerInitialized()
        {
            if (!_cfg.EnablePlugin) return;
            if (_cfg.EnableAutoCleanup && _cfg.ScanIntervalMinutes > 0)
                timer.Every(_cfg.ScanIntervalMinutes * 60f, () => RunScan(null, auto: true));
        }

        void Unload() => SaveData();

        void LoadData()
        {
            try   { _data = Interface.Oxide.DataFileSystem.ReadObject<ReclaimData>(DataFile) ?? new ReclaimData(); }
            catch { _data = new ReclaimData(); }
            if (_data.PlayerLastSeen == null) _data.PlayerLastSeen = new Dictionary<string, long>();
            if (_data.Protected      == null) _data.Protected      = new HashSet<string>();
            if (_data.Ignored        == null) _data.Ignored        = new HashSet<string>();
            if (_data.History        == null) _data.History        = new List<CleanupEntry>();
            if (_data.Warnings       == null) _data.Warnings       = new List<WarningRecord>();
        }

        void SaveData() => Interface.Oxide.DataFileSystem.WriteObject(DataFile, _data);

        // ── Oxide hooks ───────────────────────────────────────────────────────
        void OnPlayerConnected(BasePlayer player)
        {
            _data.PlayerLastSeen[player.UserIDString] = UnixNow();
            if (_cfg.CleanupWarningEnabled) DeliverWarnings(player);
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
            long now = UnixNow();
            _entityLastInteraction[entity.net.ID.Value] = now;
            var ve = entity.GetComponentInParent<BaseVehicle>();
            if (ve?.net != null) _entityLastInteraction[ve.net.ID.Value] = now;
            return null;
        }

        // ── Scan ──────────────────────────────────────────────────────────────
        void RunScan(BasePlayer invoker, bool auto = false)
        {
            if (_isScanning) { if (invoker != null) SendReply(invoker, Prefix("Scan already in progress.")); return; }
            _isScanning = true;
            if (invoker != null) SendReply(invoker, Prefix("Scanning server entities..."));

            try
            {
                long now = UnixNow();
                var summary     = new ScanSummary();
                var bases       = new List<BaseEntry>();
                var vehicles    = new List<VehicleEntry>();
                var deployables = new List<DeployableEntry>();

                // Single pass over all entities, classify by type
                foreach (BaseNetworkable net in BaseNetworkable.serverEntities)
                {
                    if (net == null || net.IsDestroyed) continue;
                    var entity = net as BaseEntity;
                    if (entity == null) continue;

                    // ── TC / base ─────────────────────────────────────────────
                    var tc = entity as BuildingPrivilege;
                    if (tc != null)
                    {
                        var entry = ClassifyBase(tc, now);
                        summary.TotalBases++;
                        if (entry.Status == "Abandoned" || entry.Status == "CleanupReady") summary.AbandonedBases++;
                        if (entry.Status == "CleanupReady") summary.CleanupReadyBases++;
                        if (entry.Status == "Protected") summary.ProtectedCount++;
                        if (entry.Status != "Active" && entry.Status != "Protected") summary.EstimatedEntities += entry.EntityCount;
                        if (!entry.IsIgnored) bases.Add(entry);
                        continue;
                    }

                    // ── Vehicle ───────────────────────────────────────────────
                    if (IsTrackedVehicle(entity))
                    {
                        var entry = ClassifyVehicle(entity, now);
                        summary.TotalVehicles++;
                        if (entry.Status == "Unused" || entry.Status == "CleanupReady") summary.UnusedVehicles++;
                        if (entry.Status != "Active" && entry.Status != "Protected") summary.EstimatedEntities++;
                        if (!entry.IsIgnored) vehicles.Add(entry);
                        continue;
                    }

                    // ── Deployable ────────────────────────────────────────────
                    if (IsTrackedDeployable(entity))
                    {
                        var entry = ClassifyDeployable(entity, now);
                        summary.TotalDeployables++;
                        if (entry.Status == "Abandoned" || entry.Status == "CleanupReady") summary.AbandonedDeployables++;
                        if (entry.Status != "Active" && entry.Status != "Protected") summary.EstimatedEntities++;
                        if (!entry.IsIgnored) deployables.Add(entry);
                    }
                }

                bases.Sort((a, b) => StatusOrder(a.Status).CompareTo(StatusOrder(b.Status)));
                vehicles.Sort((a, b) => StatusOrder(a.Status).CompareTo(StatusOrder(b.Status)));
                deployables.Sort((a, b) => StatusOrder(a.Status).CompareTo(StatusOrder(b.Status)));

                _cachedBases       = bases;
                _cachedVehicles    = vehicles;
                _cachedDeployables = deployables;
                _data.LastScan     = summary;
                _data.LastScanTime = DateTime.UtcNow.ToString("o");

                if (_cfg.CleanupWarningEnabled) IssueWarnings(bases);
                if (auto && _cfg.EnableAutoCleanup) RunAutoCleanup();

                SaveData();

                if (invoker != null)
                    SendReply(invoker, Prefix(string.Format(
                        "Done. Bases: {0} ({1} flagged) | Vehicles: {2} ({3} unused) | Deployables: {4} ({5} flagged)",
                        summary.TotalBases, summary.AbandonedBases,
                        summary.TotalVehicles, summary.UnusedVehicles,
                        summary.TotalDeployables, summary.AbandonedDeployables)));
            }
            finally { _isScanning = false; }
        }

        BaseEntry ClassifyBase(BuildingPrivilege tc, long now)
        {
            string netId    = tc.net.ID.Value.ToString();
            string ownerId  = tc.OwnerID.ToString();
            string ownerName = GetPlayerName(tc.OwnerID);
            bool   prot     = _data.Protected.Contains(netId);
            bool   ignored  = _data.Ignored.Contains(netId);

            int blockCount = 0;
            try
            {
                var building = tc.GetBuilding();
                if (building?.buildingBlocks != null) blockCount = building.buildingBlocks.Count;
            }
            catch { }

            bool upkeepEmpty = tc.inventory == null || tc.inventory.itemList.Count == 0;

            long ownerSeen   = GetLastSeen(ownerId);
            long entityTouch = GetLastTouch(tc.net.ID.Value);
            long authSeen    = 0;
            if (tc.authorizedPlayers != null)
                foreach (var a in tc.authorizedPlayers)
                { long t = GetLastSeen(a.userid.ToString()); if (t > authSeen) authSeen = t; }
            long activity  = Math.Max(ownerSeen, Math.Max(entityTouch, authSeen));
            double daysSince = activity > 0 ? (now - activity) / 86400.0 : double.MaxValue;

            string status, risk, reason;
            if (prot) {
                status = "Protected"; risk = "High"; reason = "Manually protected";
            }
            else if (IsOwnerProtected(tc.OwnerID)) {
                status = "Protected"; risk = "High"; reason = "Owner is admin or recently active";
            }
            else if (daysSince >= _cfg.AbandonedBaseDays && upkeepEmpty) {
                status = "CleanupReady"; risk = "Low";
                reason = string.Format("Offline {0:F0}d, TC empty", daysSince);
            }
            else if (daysSince >= _cfg.AbandonedBaseDays) {
                status = "Abandoned"; risk = "Low";
                reason = string.Format("Offline {0:F0} days", daysSince);
            }
            else if (daysSince >= _cfg.AbandonedBaseDays / 2.0) {
                status = "PossiblyAbandoned"; risk = "Medium";
                reason = string.Format("Offline {0:F0} days", daysSince);
            }
            else if (upkeepEmpty) {
                status = "Decaying"; risk = "Medium"; reason = "TC has no upkeep resources";
            }
            else {
                status = "Active"; risk = "High"; reason = "Owner recently active";
            }

            return new BaseEntry {
                Id           = netId,
                OwnerSteamId = ownerId,
                OwnerName    = ownerName,
                Status       = status,
                Risk         = risk,
                LastActivity = activity > 0 ? UnixToIso(activity) : null,
                EntityCount  = blockCount,
                Grid         = GetGrid(tc.transform.position),
                X = tc.transform.position.x,
                Y = tc.transform.position.y,
                Z = tc.transform.position.z,
                UpkeepEmpty  = upkeepEmpty,
                FlagReason   = reason,
                IsProtected  = prot,
                IsIgnored    = ignored,
            };
        }

        VehicleEntry ClassifyVehicle(BaseEntity entity, long now)
        {
            string netId    = entity.net.ID.Value.ToString();
            string ownerId  = entity.OwnerID.ToString();
            bool   prot     = _data.Protected.Contains(netId);
            bool   ignored  = _data.Ignored.Contains(netId);

            long lastUsed    = GetLastTouch(entity.net.ID.Value);
            double daysUnused = lastUsed > 0 ? (now - lastUsed) / 86400.0 : double.MaxValue;
            float hp         = entity.MaxHealth() > 0 ? entity.health / entity.MaxHealth() : 1f;
            bool decaying    = hp < 0.3f;

            string status, risk;
            if (prot)                                              { status = "Protected";    risk = "High"; }
            else if (decaying && daysUnused >= _cfg.VehicleInactiveDays) { status = "CleanupReady"; risk = "Low"; }
            else if (daysUnused >= _cfg.VehicleInactiveDays)             { status = "Unused";       risk = "Low"; }
            else if (decaying)                                     { status = "Decaying";     risk = "Medium"; }
            else                                                   { status = "Active";       risk = "High"; }

            return new VehicleEntry {
                Id           = netId,
                EntityType   = GetVehicleType(entity),
                OwnerSteamId = ownerId,
                OwnerName    = GetPlayerName(entity.OwnerID),
                Status       = status,
                Risk         = risk,
                LastUsed     = lastUsed > 0 ? UnixToIso(lastUsed) : null,
                Grid         = GetGrid(entity.transform.position),
                X = entity.transform.position.x,
                Y = entity.transform.position.y,
                Z = entity.transform.position.z,
                HealthPercent = hp,
                IsDecaying   = decaying,
                IsProtected  = prot,
                IsIgnored    = ignored,
            };
        }

        DeployableEntry ClassifyDeployable(BaseEntity entity, long now)
        {
            string netId   = entity.net.ID.Value.ToString();
            string ownerId = entity.OwnerID.ToString();
            bool   prot    = _data.Protected.Contains(netId);
            bool   ignored = _data.Ignored.Contains(netId);
            bool   hasTc   = false;
            try { hasTc = entity.GetBuildingPrivilege() != null; } catch { }

            long ownerSeen   = GetLastSeen(ownerId);
            long touch       = GetLastTouch(entity.net.ID.Value);
            long activity    = Math.Max(ownerSeen, touch);
            double daysSince = activity > 0 ? (now - activity) / 86400.0 : double.MaxValue;

            string status, risk;
            if (prot)                                                                     { status = "Protected";    risk = "High"; }
            else if (!hasTc && daysSince >= _cfg.DeployableInactiveDays)                 { status = "CleanupReady"; risk = "Low"; }
            else if (!hasTc && daysSince >= _cfg.DeployableInactiveDays / 2.0)           { status = "Abandoned";    risk = "Medium"; }
            else                                                                           { status = "Active";       risk = "High"; }

            return new DeployableEntry {
                Id              = netId,
                EntityType      = entity.ShortPrefabName,
                OwnerSteamId    = ownerId,
                OwnerName       = GetPlayerName(entity.OwnerID),
                Status          = status,
                Risk            = risk,
                LastInteraction = activity > 0 ? UnixToIso(activity) : null,
                Grid            = GetGrid(entity.transform.position),
                X = entity.transform.position.x,
                Y = entity.transform.position.y,
                Z = entity.transform.position.z,
                HasTCCoverage   = hasTc,
                IsProtected     = prot,
                IsIgnored       = ignored,
            };
        }

        // ── Auto-cleanup ──────────────────────────────────────────────────────
        void RunAutoCleanup()
        {
            int count = 0;
            foreach (var entry in _cachedBases)
            {
                if (count >= _cfg.MaxEntitiesDeletedPerRun) break;
                if (entry.Risk != "Low" || entry.Status != "CleanupReady") continue;
                if (entry.IsProtected || entry.IsIgnored) continue;

                uint netId; if (!uint.TryParse(entry.Id, out netId)) continue;
                var tc = FindEntity(netId) as BuildingPrivilege;
                if (tc == null || tc.IsDestroyed) continue;

                int killed = KillBase(tc);
                count += killed;

                _data.History.Insert(0, new CleanupEntry {
                    Admin = "AutoCleanup", EntityType = "Base",
                    OwnerName = entry.OwnerName, OwnerId = entry.OwnerSteamId,
                    Grid = entry.Grid,
                    Position = string.Format("{0:F0}/{1:F0}/{2:F0}", entry.X, entry.Y, entry.Z),
                    EntityCount = killed, Reason = entry.FlagReason,
                    Time = DateTime.UtcNow.ToString("o"), Automatic = true,
                });
            }
            TrimHistory();
        }

        int KillBase(BuildingPrivilege tc)
        {
            int count = 0;
            try
            {
                var building = tc.GetBuilding();
                if (building?.buildingBlocks != null)
                {
                    var blocks = new List<BuildingBlock>(building.buildingBlocks);
                    foreach (var b in blocks) { if (!b.IsDestroyed) { b.Kill(); count++; } }
                }
            }
            catch { }
            if (!tc.IsDestroyed) { tc.Kill(); count++; }
            return count;
        }

        // ── Warnings ──────────────────────────────────────────────────────────
        void IssueWarnings(List<BaseEntry> bases)
        {
            foreach (var entry in bases)
            {
                if (entry.Status != "PossiblyAbandoned" && entry.Status != "Abandoned") continue;
                if (entry.IsProtected || entry.IsIgnored) continue;
                if (_data.Warnings.Exists(w => w.PlayerId == entry.OwnerSteamId && !w.Delivered)) continue;

                _data.Warnings.Add(new WarningRecord {
                    PlayerId   = entry.OwnerSteamId,
                    PlayerName = entry.OwnerName,
                    Message    = string.Format(
                        "Your base near {0} appears inactive and may be cleaned up in {1} days. " +
                        "Log in and interact with your TC to mark it active.",
                        entry.Grid, _cfg.CleanupWarningDays),
                    IssuedTime = DateTime.UtcNow.ToString("o"),
                    Delivered  = false,
                });
            }
            if (_data.Warnings.Count > 500)
                _data.Warnings = _data.Warnings.Skip(_data.Warnings.Count - 500).ToList();
        }

        void DeliverWarnings(BasePlayer player)
        {
            foreach (var w in _data.Warnings)
                if (w.PlayerId == player.UserIDString && !w.Delivered)
                    { SendReply(player, Prefix(w.Message)); w.Delivered = true; }
        }

        // ── Chat commands ─────────────────────────────────────────────────────
        [ChatCommand("reclaim")]
        void CmdReclaimChat(BasePlayer player, string cmd, string[] args)
        {
            bool canScan   = permission.UserHasPermission(player.UserIDString, PermScan)   || permission.UserHasPermission(player.UserIDString, PermAdmin);
            bool canProt   = permission.UserHasPermission(player.UserIDString, PermProtect)|| permission.UserHasPermission(player.UserIDString, PermAdmin);
            bool canIgnore = permission.UserHasPermission(player.UserIDString, PermIgnore) || permission.UserHasPermission(player.UserIDString, PermAdmin);

            if (!canScan && !canProt && !canIgnore)
            { SendReply(player, Prefix("You do not have permission.")); return; }

            string sub = args.Length > 0 ? args[0].ToLower() : "help";
            switch (sub)
            {
                case "scan":
                    if (!canScan) { SendReply(player, Prefix("No scan permission.")); return; }
                    if (_isScanning) { SendReply(player, Prefix("Scan already in progress.")); return; }
                    timer.Once(0.1f, () => RunScan(player));
                    break;
                case "stats":
                    if (_data.LastScan == null) { SendReply(player, Prefix("No scan data. Run /reclaim scan first.")); return; }
                    var s = _data.LastScan;
                    SendReply(player, string.Format("{0}\nBases: {1} total, {2} flagged, {3} cleanup-ready\nVehicles: {4} total, {5} unused\nDeployables: {6} total, {7} flagged\nEst. reclaimable entities: {8}",
                        Prefix("Stats"), s.TotalBases, s.AbandonedBases, s.CleanupReadyBases, s.TotalVehicles, s.UnusedVehicles, s.TotalDeployables, s.AbandonedDeployables, s.EstimatedEntities));
                    break;
                case "protect":
                    if (!canProt) { SendReply(player, Prefix("No protect permission.")); return; }
                    DoLookAtAction(player, true, false);
                    break;
                case "ignore":
                    if (!canIgnore) { SendReply(player, Prefix("No ignore permission.")); return; }
                    DoLookAtAction(player, false, true);
                    break;
                default:
                    SendReply(player, Prefix("Commands: /reclaim scan | stats | protect | ignore"));
                    break;
            }
        }

        void DoLookAtAction(BasePlayer player, bool protect, bool ignore)
        {
            RaycastHit hit;
            if (!Physics.Raycast(player.eyes.HeadRay(), out hit, 50f))
            { SendReply(player, Prefix("Look at an entity within 50m.")); return; }

            var entity = hit.GetEntity();
            if (entity?.net == null) { SendReply(player, Prefix("No entity found.")); return; }

            string netId = entity.net.ID.Value.ToString();
            if (protect) { _data.Protected.Add(netId); _data.Ignored.Remove(netId); }
            else         { _data.Ignored.Add(netId);   _data.Protected.Remove(netId); }
            SaveData();
            SendReply(player, Prefix(string.Format("{0} {1} (netID {2}).",
                protect ? "Protected" : "Ignored", entity.ShortPrefabName, netId)));
        }

        // ── Console / RCON commands ───────────────────────────────────────────
        [ConsoleCommand("reclaim.scan")]
        void ConsoleScan(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (_isScanning) { arg.ReplyWith("{\"status\":\"already_scanning\"}"); return; }
            timer.Once(0.1f, () => RunScan(null));
            arg.ReplyWith("{\"status\":\"scan_started\"}");
        }

        [ConsoleCommand("reclaim.getsummary")]
        void ConsoleGetSummary(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            arg.ReplyWith(JsonConvert.SerializeObject(new {
                lastScanTime         = _data.LastScanTime,
                isScanning           = _isScanning,
                hasScanData          = _data.LastScan != null,
                totalBases           = _data.LastScan != null ? _data.LastScan.TotalBases           : 0,
                abandonedBases       = _data.LastScan != null ? _data.LastScan.AbandonedBases       : 0,
                cleanupReadyBases    = _data.LastScan != null ? _data.LastScan.CleanupReadyBases    : 0,
                protectedCount       = _data.LastScan != null ? _data.LastScan.ProtectedCount       : 0,
                totalVehicles        = _data.LastScan != null ? _data.LastScan.TotalVehicles        : 0,
                unusedVehicles       = _data.LastScan != null ? _data.LastScan.UnusedVehicles       : 0,
                totalDeployables     = _data.LastScan != null ? _data.LastScan.TotalDeployables     : 0,
                abandonedDeployables = _data.LastScan != null ? _data.LastScan.AbandonedDeployables : 0,
                estimatedEntities    = _data.LastScan != null ? _data.LastScan.EstimatedEntities    : 0,
            }));
        }

        [ConsoleCommand("reclaim.getbases")]
        void ConsoleGetBases(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            int page = arg.HasArgs()    ? Mathf.Max(0, arg.GetInt(0)) : 0;
            int size = arg.HasArgs(2)   ? Mathf.Clamp(arg.GetInt(1), 1, 200) : 50;
            var items = _cachedBases.Skip(page * size).Take(size).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = _cachedBases.Count, page, pageSize = size, items }));
        }

        [ConsoleCommand("reclaim.getvehicles")]
        void ConsoleGetVehicles(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            int page = arg.HasArgs()    ? Mathf.Max(0, arg.GetInt(0)) : 0;
            int size = arg.HasArgs(2)   ? Mathf.Clamp(arg.GetInt(1), 1, 200) : 50;
            var items = _cachedVehicles.Skip(page * size).Take(size).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = _cachedVehicles.Count, page, pageSize = size, items }));
        }

        [ConsoleCommand("reclaim.getdeployables")]
        void ConsoleGetDeployables(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            int page = arg.HasArgs()    ? Mathf.Max(0, arg.GetInt(0)) : 0;
            int size = arg.HasArgs(2)   ? Mathf.Clamp(arg.GetInt(1), 1, 200) : 50;
            var items = _cachedDeployables.Skip(page * size).Take(size).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = _cachedDeployables.Count, page, pageSize = size, items }));
        }

        [ConsoleCommand("reclaim.getprotected")]
        void ConsoleGetProtected(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            var list = new List<object>();
            foreach (var id in _data.Protected)
            {
                var b = _cachedBases.Find(x => x.Id == id);
                var v = _cachedVehicles.Find(x => x.Id == id);
                var d = _cachedDeployables.Find(x => x.Id == id);
                if      (b != null) list.Add(new { id, type = "Base",       owner = b.OwnerName, grid = b.Grid, status = b.Status });
                else if (v != null) list.Add(new { id, type = v.EntityType, owner = v.OwnerName, grid = v.Grid, status = v.Status });
                else if (d != null) list.Add(new { id, type = d.EntityType, owner = d.OwnerName, grid = d.Grid, status = d.Status });
                else                list.Add(new { id, type = "Unknown",    owner = "",          grid = "",     status = "Protected" });
            }
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = list.Count, items = list }));
        }

        [ConsoleCommand("reclaim.gethistory")]
        void ConsoleGetHistory(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            int page = arg.HasArgs() ? Mathf.Max(0, arg.GetInt(0)) : 0;
            const int size = 50;
            var items = _data.History.Skip(page * size).Take(size).ToList();
            arg.ReplyWith(JsonConvert.SerializeObject(new { total = _data.History.Count, page, pageSize = size, items }));
        }

        [ConsoleCommand("reclaim.protect")]
        void ConsoleProtect(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("netId required")); return; }
            string id = arg.GetString(0);
            _data.Protected.Add(id); _data.Ignored.Remove(id);
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "protected", netId = id }));
        }

        [ConsoleCommand("reclaim.unprotect")]
        void ConsoleUnprotect(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("netId required")); return; }
            string id = arg.GetString(0);
            _data.Protected.Remove(id);
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "unprotected", netId = id }));
        }

        [ConsoleCommand("reclaim.ignore")]
        void ConsoleIgnore(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("netId required")); return; }
            string id = arg.GetString(0);
            _data.Ignored.Add(id); _data.Protected.Remove(id);
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "ignored", netId = id }));
        }

        [ConsoleCommand("reclaim.unignore")]
        void ConsoleUnignore(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("netId required")); return; }
            string id = arg.GetString(0);
            _data.Ignored.Remove(id);
            SaveData();
            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, action = "unignored", netId = id }));
        }

        [ConsoleCommand("reclaim.delete")]
        void ConsoleDelete(ConsoleSystem.Arg arg)
        {
            if (!IsRconOrAdmin(arg)) { arg.ReplyWith(Err("No permission")); return; }
            if (!arg.HasArgs()) { arg.ReplyWith(Err("netId required")); return; }
            string netIdStr = arg.GetString(0);
            uint netId;
            if (!uint.TryParse(netIdStr, out netId)) { arg.ReplyWith(Err("Invalid netId")); return; }

            if (_data.Protected.Contains(netIdStr)) { arg.ReplyWith(Err("Entity is protected. Unprotect first.")); return; }

            var entity = FindEntity(netId);
            if (entity == null || entity.IsDestroyed) { arg.ReplyWith(Err("Entity not found or already destroyed")); return; }

            string grid  = GetGrid(entity.transform.position);
            string pos   = string.Format("{0:F0}/{1:F0}/{2:F0}", entity.transform.position.x, entity.transform.position.y, entity.transform.position.z);
            string owner = GetPlayerName(entity.OwnerID);
            string type  = entity.ShortPrefabName;
            int    count = 1;

            var tc = entity as BuildingPrivilege;
            if (tc != null) { type = "Base"; count = KillBase(tc); }
            else            { entity.Kill(); }

            string admin = arg.IsRcon ? "RCON/Panel" : (arg.Player() != null ? arg.Player().displayName : "Console");
            _data.History.Insert(0, new CleanupEntry {
                Admin = admin, EntityType = type, OwnerName = owner,
                OwnerId = entity.OwnerID.ToString(), Grid = grid, Position = pos,
                EntityCount = count, Reason = "Manual delete via MyRcon",
                Time = DateTime.UtcNow.ToString("o"), Automatic = false,
            });
            TrimHistory();
            SaveData();

            arg.ReplyWith(JsonConvert.SerializeObject(new { success = true, type, owner, grid, entityCount = count }));
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        string GetPlayerName(ulong id)
        {
            if (id == 0) return "Unknown";
            var p = BasePlayer.FindByID(id) ?? BasePlayer.FindSleeping(id);
            if (p != null) return p.displayName;
            var u = ServerUsers.Get(id);
            return u?.username ?? id.ToString();
        }

        long GetLastSeen(string steamId)
        {
            long t;
            if (_data.PlayerLastSeen.TryGetValue(steamId, out t)) return t;
            ulong uid;
            if (ulong.TryParse(steamId, out uid) && BasePlayer.FindByID(uid) != null)
            { t = UnixNow(); _data.PlayerLastSeen[steamId] = t; return t; }
            return 0;
        }

        long GetLastTouch(uint netId) { long t; return _entityLastInteraction.TryGetValue(netId, out t) ? t : 0; }

        bool IsOwnerProtected(ulong id)
        {
            if (id == 0) return false;
            if (_cfg.ProtectAdmins)
            {
                var p = BasePlayer.FindByID(id);
                if (p != null && p.IsAdmin) return true;
                if (ServerUsers.Is(id, ServerUsers.UserGroup.Moderator)) return true;
            }
            if (_cfg.ProtectPlayersWithRecentLogin)
            {
                long seen = GetLastSeen(id.ToString());
                if (seen > 0 && (UnixNow() - seen) / 86400.0 <= _cfg.RecentLoginDays) return true;
            }
            return false;
        }

        bool IsRconOrAdmin(ConsoleSystem.Arg arg)
        {
            if (arg.IsRcon) return true;
            var p = arg.Player();
            return p != null && (p.IsAdmin || permission.UserHasPermission(p.UserIDString, PermAdmin));
        }

        bool IsTrackedVehicle(BaseEntity e)
        {
            if (e == null || e is BuildingBlock) return false;
            if (!(e is BaseVehicle)) return false;
            // Skip mounted seats, fuel tanks etc. — want top-level vehicles only
            if (e.GetParentEntity() is BaseVehicle) return false;
            string name = e.ShortPrefabName;
            foreach (string part in VehicleParts) if (name.Contains(part)) return true;
            if (e is ModularCar) return true;
            return false;
        }

        bool IsTrackedDeployable(BaseEntity e)
        {
            if (e == null) return false;
            if (e is BuildingBlock || e is BuildingPrivilege || e is BasePlayer) return false;
            if (e.OwnerID == 0) return false;  // filters NPCs, world entities, etc.
            if (e is BaseVehicle) return false;
            string name = e.ShortPrefabName;
            foreach (string part in DeployableParts) if (name.Contains(part)) return true;
            return false;
        }

        string GetVehicleType(BaseEntity e)
        {
            if (e is Minicopter && !(e is ScrapTransportHelicopter)) return "Minicopter";
            if (e is ScrapTransportHelicopter) return "Scrap Heli";
            if (e is Tugboat) return "Tugboat";
            if (e is ModularCar) return "Modular Car";
            if (e is RidableHorse) return "Horse";
            if (e is Snowmobile) return "Snowmobile";
            if (e is MotorBoat) return e.ShortPrefabName.Contains("rhib") ? "RHIB" : "Boat";
            return e.ShortPrefabName;
        }

        string GetGrid(Vector3 pos)
        {
            float mapSize  = TerrainMeta.Size.x;
            if (mapSize <= 0) return "?";
            float gridSize = 146.3f;
            int col = Mathf.FloorToInt((pos.x + mapSize / 2f) / gridSize);
            int row = Mathf.FloorToInt((mapSize / 2f - pos.z) / gridSize);
            string colStr = "";
            int tmp = col;
            do { colStr = ((char)('A' + (tmp % 26))).ToString() + colStr; tmp = tmp / 26 - 1; } while (tmp >= 0);
            return colStr + (row + 1);
        }

        BaseEntity FindEntity(uint netId)
        {
            foreach (BaseNetworkable net in BaseNetworkable.serverEntities)
            { if (net?.net != null && net.net.ID.Value == netId) return net as BaseEntity; }
            return null;
        }

        int StatusOrder(string s)
        {
            switch (s) {
                case "CleanupReady": return 0; case "Abandoned": return 1; case "Decaying": return 2;
                case "PossiblyAbandoned": return 3; case "Unknown": return 4; case "Protected": return 5;
                default: return 6;
            }
        }

        void TrimHistory() { if (_data.History.Count > 1000) _data.History = _data.History.Take(1000).ToList(); }

        static long   UnixNow()          => (long)(DateTime.UtcNow - new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalSeconds;
        static string UnixToIso(long ts) => new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc).AddSeconds(ts).ToString("o");
        static string Prefix(string msg) => string.Format("<color=#F0A030>MyRcon Reclaim</color>: {0}", msg);
        static string Err(string msg)    => string.Format("{{\"error\":\"{0}\"}}", msg);
    }
}
