"use client";

import { useMemo, useState } from "react";
import { Copy, Play } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  isDefault: boolean;
};

type ConnectionDetails = {
  configuredRconType: string;
  normalizedRconType: string;
  actualClientImplementation: string;
  transport: string;
  websocketUrl?: string;
  passwordHasSurroundingWhitespace?: boolean;
  connectionState?: string;
  lastSuccessfulConnectionAt?: string | null;
  lastSuccessfulCommandAt?: string | null;
  lastSuccessfulCommandName?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
};

type Diagnostics = {
  appVersion: string;
  buildStamp: string;
  connectionDetails: ConnectionDetails;
  liveStatus: {
    source: string;
    online: boolean;
    error: string | null;
    errorState: string | null;
  };
};

type WebRconTestResult = {
  ok: boolean;
  stage: string;
  rawResponse: string | null;
  protocolLog: string[];
  connectionDetails: ConnectionDetails;
  passwordOverrideUsed: boolean;
  passwordOverrideMatchesSaved: boolean | null;
  protocolDetection?: {
    webRcon: {
      ok: boolean;
      error: string | null;
      state: string | null;
    };
    legacy: {
      ok: boolean;
      error: string | null;
      rawResponse: string | null;
    };
    likelyProtocol: string;
    recommendation: string;
  };
  error?: {
    message: string;
    state: string;
    suggestedFix?: string;
    stack?: string;
  };
};

function Value({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-100">{value || "none"}</div>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard copy failed");
  }
}

export function DiagnosticsClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [testResult, setTestResult] = useState<WebRconTestResult | null>(null);
  const [testPassword, setTestPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = useMemo(() => servers.find((server) => server.id === serverId), [servers, serverId]);
  const details = diagnostics?.connectionDetails ?? testResult?.connectionDetails;

  async function loadDiagnostics() {
    if (!serverId) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await api<Diagnostics>(`/api/servers/${serverId}/diagnostics`);
      setDiagnostics(data);
      setNotice("Diagnostics loaded");
    } catch (error) {
      setNotice(error instanceof Error ? `Diagnostics failed: ${error.message}` : "Diagnostics failed");
    } finally {
      setLoading(false);
    }
  }

  async function testWebRcon() {
    if (!serverId) return;
    setLoading(true);
    setNotice("Testing WebRCON...");
    try {
      const result = await api<WebRconTestResult>(`/api/servers/${serverId}/web-rcon-test`, {
        method: "POST",
        body: JSON.stringify(testPassword.trim() ? { password: testPassword } : {}),
      });
      setTestResult(result);
      setNotice(result.ok ? "WebRCON test succeeded" : `WebRCON test failed at ${result.stage}`);
    } catch (error) {
      const details = typeof error === "object" && error && "details" in error ? (error.details as WebRconTestResult) : null;
      if (details?.stage) {
        setTestResult(details);
      }
      setNotice(error instanceof Error ? `WebRCON test failed: ${error.message}` : "WebRCON test failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    const text = [
      `Server: ${selected?.name ?? "none"}`,
      `Host: ${selected?.host ?? "none"}`,
      `RCON port: ${selected?.rconPort ?? "none"}`,
      `Configured RCON type: ${details?.configuredRconType ?? selected?.rconType ?? "none"}`,
      `Selected implementation: ${details?.actualClientImplementation ?? "unknown"}`,
      `Transport: ${details?.transport ?? "unknown"}`,
      details?.websocketUrl ? `WebSocket URL: ${details.websocketUrl}` : null,
      `Saved password has surrounding whitespace: ${details?.passwordHasSurroundingWhitespace ? "yes" : "no"}`,
      testResult ? `Temporary password override used: ${testResult.passwordOverrideUsed ? "yes" : "no"}` : null,
      testResult ? `Temporary password matches saved password: ${testResult.passwordOverrideMatchesSaved === null ? "not tested" : testResult.passwordOverrideMatchesSaved ? "yes" : "no"}` : null,
      testResult ? `Test stage: ${testResult.stage}` : null,
      testResult?.error ? `Test error: ${testResult.error.message}` : null,
      testResult?.protocolDetection ? `Likely protocol: ${testResult.protocolDetection.likelyProtocol}` : null,
      testResult?.protocolDetection ? `Legacy probe: ${testResult.protocolDetection.legacy.ok ? "success" : "failed"}` : null,
      testResult?.protocolDetection?.legacy.error ? `Legacy probe error: ${testResult.protocolDetection.legacy.error}` : null,
      testResult?.protocolDetection ? `Recommendation: ${testResult.protocolDetection.recommendation}` : null,
      testResult?.protocolLog.length ? `Protocol log:\n${testResult.protocolLog.join("\n")}` : null,
      testResult?.rawResponse ? `Raw response:\n${testResult.rawResponse}` : null,
      testResult?.protocolDetection?.legacy.rawResponse ? `Legacy raw response:\n${testResult.protocolDetection.legacy.rawResponse}` : null,
    ].filter(Boolean).join("\n");

    await copyText(text);
    setNotice("Diagnostics copied");
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Diagnostics</h1>
          <p className="mt-1 text-sm text-slate-400">Inspect the selected RCON transport and run a raw WebRCON test.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={serverId} onChange={(event) => setServerId(event.target.value)} className="min-w-56">
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={loadDiagnostics} disabled={loading}>Refresh</Button>
          <Button onClick={testWebRcon} disabled={loading || !serverId}><Play className="h-4 w-4" />Test WebRCON</Button>
        </div>
      </div>

      <Panel>
        <Field
          label="Temporary RCON password test"
          hint="Optional. Used for this diagnostics request only, never saved or displayed."
        >
          <Input
            type="text"
            value={testPassword}
            onChange={(event) => setTestPassword(event.target.value)}
            autoComplete="off"
            placeholder="Leave blank to use saved password"
          />
        </Field>
      </Panel>

      {notice ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</div> : null}

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Connection Details</h2>
          <Button variant="secondary" onClick={copyResult}><Copy className="h-4 w-4" />Copy</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Value label="Configured RCON type" value={details?.configuredRconType ?? selected?.rconType} />
          <Value label="Normalized RCON type" value={details?.normalizedRconType} />
          <Value label="Actual client implementation" value={details?.actualClientImplementation} />
          <Value label="Transport" value={details?.transport} />
          <Value label="WebSocket URL" value={details?.websocketUrl} />
          <Value label="Saved password whitespace" value={details?.passwordHasSurroundingWhitespace === undefined ? undefined : details.passwordHasSurroundingWhitespace ? "yes, trimmed while connecting" : "no"} />
          <Value label="Connection state" value={details?.connectionState ?? diagnostics?.liveStatus.errorState} />
          <Value label="Last successful connection" value={details?.lastSuccessfulConnectionAt} />
          <Value label="Last successful command" value={details?.lastSuccessfulCommandName} />
          <Value label="Last successful command time" value={details?.lastSuccessfulCommandAt} />
          <Value label="Last error time" value={details?.lastErrorAt} />
          <Value label="Last error" value={details?.lastError ?? diagnostics?.liveStatus.error} />
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold text-white">WebRCON Test</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Value label="Result" value={testResult ? (testResult.ok ? "success" : "failed") : "not run"} />
          <Value label="Stage" value={testResult?.stage} />
          <Value label="Error" value={testResult?.error?.message} />
          <Value label="Temporary password used" value={testResult ? (testResult.passwordOverrideUsed ? "yes" : "no") : undefined} />
          <Value label="Temporary password matches saved" value={testResult ? (testResult.passwordOverrideMatchesSaved === null ? "not tested" : testResult.passwordOverrideMatchesSaved ? "yes" : "no") : undefined} />
          <Value label="Likely protocol" value={testResult?.protocolDetection?.likelyProtocol} />
          <Value label="Legacy probe" value={testResult?.protocolDetection ? (testResult.protocolDetection.legacy.ok ? "success" : "failed") : undefined} />
          <Value label="Recommendation" value={testResult?.protocolDetection?.recommendation} />
        </div>
        <pre className="mt-4 max-h-80 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-black/30 p-4 text-xs leading-6 text-slate-300">
          {testResult?.protocolLog.length ? testResult.protocolLog.join("\n") : "Run Test WebRCON to capture protocol steps."}
        </pre>
        <pre className="mt-4 max-h-80 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-black/30 p-4 text-xs leading-6 text-slate-300">
          {testResult?.rawResponse ?? "Raw response will appear here."}
        </pre>
      </Panel>
    </div>
  );
}
