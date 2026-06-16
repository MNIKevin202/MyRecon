// MyRcon Exclusive Plugins registry.
// Plugin .cs files live in /plugins on GitHub and are fetched at install time.
// To release a plugin update: push the .cs + update plugins/manifest.json.
// No app rebuild needed for plugin-only changes.

export type ExclusivePlugin = {
  id: string;
  name: string;
  version: string;           // fallback version shown before manifest loads
  description: string;
  longDescription: string;
  tags: string[];
  filename: string;          // filename on the server
  defaultPath: string;       // relative install path (oxide/carbon)
  permissions: string[];     // Oxide/Carbon permission nodes
  previewItems: string[];    // item shortnames for the preview image strip
  contentUrl: string;        // GitHub raw URL — fetched at install time
};

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
    contentUrl: "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/MyRconAdminPanel.cs",
  },
  {
    id: "reclaim",
    name: "Reclaim",
    version: "1.0.0",
    description: "PvE server cleanup and abandoned asset management. Detect abandoned bases, unused vehicles, and orphaned deployables.",
    longDescription: "Tracks player last-seen times, entity interactions (loot, doors, vehicle mounts), and runs on-demand scans to classify every TC-covered base, vehicle, and standalone deployable on the server. Results feed directly into the MyRCON Reclaim panel. Admins can protect, ignore, or delete flagged assets individually. Optional auto-cleanup (off by default) targets only Low-risk CleanupReady assets. Player warning system notifies owners on next login before any action is taken. Requires myrconreclaim.admin permission.",
    tags: ["PvE", "Cleanup", "Admin", "Performance"],
    filename: "MyRconReclaim.cs",
    defaultPath: "oxide/plugins/MyRconReclaim.cs",
    permissions: [
      "myrconreclaim.admin",
      "myrconreclaim.scan",
      "myrconreclaim.inspect",
      "myrconreclaim.delete",
      "myrconreclaim.protect",
      "myrconreclaim.ignore",
      "myrconreclaim.autocleanup",
    ],
    previewItems: [
      "hammer", "lock.code", "box.wooden.large", "sleepingbag_leather_deployed",
      "autoturret_deployed", "furnace", "rowboat", "minicopter.entity",
      "campfire", "workbench2.deployed", "building.planner", "tool.camera",
    ],
    contentUrl: "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/MyRconReclaim.cs",
  },
];

export function getPlugin(id: string): ExclusivePlugin | undefined {
  return EXCLUSIVE_PLUGINS.find((p) => p.id === id);
}
