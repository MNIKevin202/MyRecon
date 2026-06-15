import { ServerProfile } from "@prisma/client";
import { readTextFile } from "@/server/sftp/service";
import { getOpenAiCredentials } from "@/server/settings/ai";

export type PluginAnalysis = {
  aiEnabled: boolean;
  model: string | null;
  path: string;
  size: number;
  summary: string;
  permissions: string[];
  configKeys: string[];
  commands: string[];
  suggestions: string[];
  risks: string[];
};

const MAX_ANALYSIS_CHARS = 120_000;

function uniqueMatches(source: string, patterns: RegExp[]) {
  const values = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = String(match[1] ?? "").trim();
      if (value) values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function localAnalyze(source: string, path: string, size: number): PluginAnalysis {
  const permissions = uniqueMatches(source, [
    /permission\.RegisterPermission\(\s*"([^"]+)"/gi,
    /permission\.UserHasPermission\([^,]+,\s*"([^"]+)"/gi,
    /HasPermission\([^,]+,\s*"([^"]+)"/gi,
  ]);
  const commands = uniqueMatches(source, [
    /\[(?:ChatCommand|ConsoleCommand)\(\s*"([^"]+)"/gi,
    /cmd\.Add(?:Chat|Console)Command\(\s*"([^"]+)"/gi,
  ]);
  const configKeys = uniqueMatches(source, [
    /Config\["([^"]+)"\]/g,
    /GetConfig<[^>]+>\(\s*"([^"]+)"/g,
  ]);
  const suggestions = [
    permissions.length ? "Review permission names and expose common permissions in the MyRcon plugin manager." : "No obvious Oxide permission registrations were found; check whether this plugin uses custom access logic.",
    configKeys.length ? "Review config defaults before enabling this plugin on a live server." : "No simple config keys were detected; the plugin may use a typed config object.",
    commands.length ? "Document player/admin commands for your moderators before enabling access." : "No obvious chat or console commands were detected.",
  ];
  const risks: string[] = [];
  if (/webrequest\.Enqueue|HttpClient|WebClient/i.test(source)) risks.push("Uses outbound web requests; verify URLs and rate limits.");
  if (/Interface\.Oxide\.DataFileSystem|DynamicConfigFile/i.test(source)) risks.push("Reads or writes data files; back up plugin data before major config changes.");
  if (/timer\.Every|timer\.Repeat|NextTick/i.test(source)) risks.push("Uses timers or repeated callbacks; watch performance after install.");
  if (/OnEntity|OnTick|OnPlayerInput|CanMoveItem/i.test(source)) risks.push("Hooks high-frequency server events; test FPS impact on a populated server.");

  return {
    aiEnabled: false,
    model: null,
    path,
    size,
    summary: "Local scan completed. Configure OpenAI to get richer code-level suggestions.",
    permissions,
    configKeys,
    commands,
    suggestions,
    risks,
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI response was not valid JSON.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
    : [];
}

async function openAiAnalyze(source: string, local: PluginAnalysis): Promise<PluginAnalysis> {
  const { apiKey, model } = await getOpenAiCredentials();
  if (!apiKey) return local;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You review Rust server Oxide/Carbon C# plugins for server admins. Return compact JSON only. Do not include markdown.",
        },
        {
          role: "user",
          content: [
            "Analyze this C# plugin and suggest safe changes for a Rust server admin.",
            "Focus on permissions, commands, config values, performance risks, security risks, and easy admin-facing improvements.",
            "Return JSON with keys: summary string, permissions string[], configKeys string[], commands string[], suggestions string[], risks string[].",
            `Known local permissions: ${local.permissions.join(", ") || "none"}`,
            `Known local commands: ${local.commands.join(", ") || "none"}`,
            "Plugin source:",
            source.slice(0, MAX_ANALYSIS_CHARS),
          ].join("\n\n"),
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI analysis failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }

  const payload = await response.json() as { output_text?: string };
  const outputText =
    payload.output_text ||
    JSON.stringify(payload);
  const parsed = parseJsonObject(outputText);

  return {
    ...local,
    aiEnabled: true,
    model,
    summary: String(parsed.summary ?? local.summary),
    permissions: stringArray(parsed.permissions).length ? stringArray(parsed.permissions) : local.permissions,
    configKeys: stringArray(parsed.configKeys).length ? stringArray(parsed.configKeys) : local.configKeys,
    commands: stringArray(parsed.commands).length ? stringArray(parsed.commands) : local.commands,
    suggestions: stringArray(parsed.suggestions).length ? stringArray(parsed.suggestions) : local.suggestions,
    risks: stringArray(parsed.risks).length ? stringArray(parsed.risks) : local.risks,
  };
}

export async function analyzePluginSource(server: ServerProfile, pluginPath: string) {
  if (!pluginPath.toLowerCase().endsWith(".cs")) {
    throw new Error("Only installed .cs plugin files can be analyzed.");
  }

  const file = await readTextFile(server, pluginPath);
  if (file.tooLarge) {
    throw new Error("This plugin file is larger than 2 MB. Download and review it outside the browser.");
  }

  const local = localAnalyze(file.content, file.path, file.size);
  return openAiAnalyze(file.content, local);
}
