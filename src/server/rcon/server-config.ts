import type { ServerProfile } from "@prisma/client";
import { executeServerCommand } from "@/server/rcon/service";

export type ConfigFieldType = "string" | "text" | "number" | "bool";
export type ConfigField = { key: string; label: string; type: ConfigFieldType; hint?: string };

// Common, safe-to-edit server convars. server.hostname is the "rename".
export const SERVER_CONFIG_FIELDS: ConfigField[] = [
  { key: "server.hostname", label: "Server name", type: "string", hint: "Name shown in the in-game server browser." },
  { key: "server.description", label: "Description", type: "text", hint: "Use \\n for line breaks." },
  { key: "server.url", label: "Website URL", type: "string" },
  { key: "server.headerimage", label: "Header image URL", type: "string", hint: "512×256 banner shown in the browser." },
  { key: "server.maxplayers", label: "Max players", type: "number" },
  { key: "server.pve", label: "PvE mode", type: "bool" },
];

function parseConvarValue(raw: string, key: string): string {
  const line = raw.split(/\r?\n/).find((l) => l.toLowerCase().includes(key.toLowerCase())) ?? raw;
  let value = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
  value = value.trim().replace(/^"|"$/g, "").trim();
  return value;
}

export async function getServerConfig(server: ServerProfile) {
  const values: Record<string, string> = {};
  for (const field of SERVER_CONFIG_FIELDS) {
    try {
      const raw = await executeServerCommand(server, field.key);
      values[field.key] = parseConvarValue(raw, field.key);
    } catch {
      values[field.key] = "";
    }
  }
  return { fields: SERVER_CONFIG_FIELDS, values };
}

function formatSetCommand(field: ConfigField, value: string): string {
  const raw = String(value ?? "");
  if (field.type === "string" || field.type === "text") {
    // Rust convar strings are double-quoted; collapse embedded quotes to keep the command valid.
    return `${field.key} "${raw.replace(/"/g, "'")}"`;
  }
  if (field.type === "bool") {
    const on = raw === "true" || raw === "True" || raw === "1";
    return `${field.key} ${on ? "true" : "false"}`;
  }
  return `${field.key} ${raw.replace(/[^0-9.-]/g, "") || "0"}`;
}

export async function setServerConfig(server: ServerProfile, values: Record<string, string>) {
  const applied: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  for (const field of SERVER_CONFIG_FIELDS) {
    if (!(field.key in values)) continue;
    try {
      await executeServerCommand(server, formatSetCommand(field, values[field.key]));
      applied.push(field.key);
    } catch (error) {
      failed.push({ key: field.key, error: error instanceof Error ? error.message : "set failed" });
    }
  }

  let configSaved = false;
  if (applied.length > 0) {
    try {
      await executeServerCommand(server, "server.writecfg");
      configSaved = true;
    } catch {
      // command sent but no/late reply — best effort
    }
  }

  return { applied, failed, configSaved };
}
