"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button, Input, Panel, Select } from "@/components/ui";
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

type ChatMessage = {
  id: string;
  username: string;
  message: string;
  color?: string;
  time: string;
};

export function ChatClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => servers.find((server) => server.id === serverId), [servers, serverId]);

  useEffect(() => {
    if (!serverId) return;

    const connectingTimer = window.setTimeout(() => {
      setMessages([]);
      setConnectionState("connecting");
    }, 0);
    const source = new EventSource(`/api/servers/${serverId}/console/stream`);

    source.addEventListener("state", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { state: string };
      setConnectionState(data.state);
    });

    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { timestamp: string; message: unknown };
      const raw = data.message as Record<string, unknown> | undefined;
      if (!raw || raw.Type !== "Chat") return;

      try {
        const payload = JSON.parse(String(raw.Message ?? "{}")) as {
          Username?: string;
          Message?: string;
          Color?: string;
          Time?: string;
        };
        setMessages((current) => [
          ...current,
          {
            id: `${data.timestamp}-${current.length}`,
            username: payload.Username ?? "Server",
            message: payload.Message ?? "",
            color: payload.Color,
            time: payload.Time ?? data.timestamp,
          },
        ].slice(-300));
      } catch {
        // not a chat payload we can parse
      }
    });

    source.addEventListener("rcon-error", () => {
      setConnectionState("disconnected");
      source.close();
    });

    source.onerror = () => {
      setConnectionState((current) => current === "connected" ? "disconnected" : current);
    };

    return () => {
      window.clearTimeout(connectingTimer);
      source.close();
      setConnectionState("disconnected");
    };
  }, [serverId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!input.trim() || !serverId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/servers/${serverId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: input.trim() }),
      });
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat</h1>
          <p className="mt-1 text-sm text-slate-400">View live in-game chat and broadcast messages to the server.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => setServerId(event.target.value)} className="min-w-56">
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
            Console: <span className="text-orange-200">{connectionState}</span>
          </span>
          {selected?.rconType !== "WEBRCON" ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
              Live chat requires a WebRCON server. Sending messages still works.
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div ref={chatRef} className="h-[52vh] overflow-auto rounded-md border border-white/10 bg-black/40 p-4 text-sm leading-6 text-slate-200">
          {messages.length === 0 ? <div className="text-slate-500">No chat messages yet.</div> : null}
          {messages.map((line) => (
            <div key={line.id} className="border-b border-white/[0.04] py-2">
              <span className="text-slate-500">[{new Date(line.time).toLocaleTimeString()}] </span>
              <span className="font-semibold text-orange-300">{line.username}</span>
              <span className="text-slate-300">: {line.message}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder="Message the server..."
          />
          <Button onClick={send} disabled={busy || !input.trim()}><Send className="h-4 w-4" />Send</Button>
        </div>
      </Panel>
    </div>
  );
}
