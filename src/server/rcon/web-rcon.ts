import WebSocket from "ws";
import { RconConnectionError } from "@/server/rcon/errors";

export type RconConnectionOptions = {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
  onMessage?: (message: RconMessage | string) => void;
  onDebug?: (message: string) => void;
};

export type RconMessage = {
  Identifier: number;
  Message: string;
  Name: string;
};

type WebRconAttempt = {
  label: string;
  url: string;
  headers?: Record<string, string>;
  rejectUnauthorized?: boolean;
};

export class WebRconClient {
  private socket?: WebSocket;
  private id = 1;
  private pending = new Map<
    number,
    { resolve: (value: RconMessage) => void; reject: (error: Error) => void }
  >();

  constructor(private options: RconConnectionOptions) {}

  async connect() {
    const attempts = buildWebRconAttempts(this.options);
    const errors: Error[] = [];

    for (const attempt of attempts) {
      try {
        this.options.onDebug?.(`[RCON] Attempt: ${attempt.label}`);
        this.options.onDebug?.(`[RCON] WebSocket URL: ${redactWebRconUrl(attempt.url)}`);
        await this.connectUrl(attempt);
        return;
      } catch (error) {
        const normalized = normalizeWebRconError(
          error instanceof Error ? error : new Error("WebRCON connection failed"),
        );
        this.options.onDebug?.(`[RCON] Attempt failed: ${attempt.label} - ${normalized.message}`);
        errors.push(normalized);
        this.close();
      }
    }

    throw buildFinalWebRconError(
      errors,
      attempts.map((attempt) => attempt.label),
    );
  }

  private connectUrl(attempt: WebRconAttempt) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let socket: WebSocket | null = null;

      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (error) {
          socket?.terminate();
          reject(error);
        }
      };

      const timeout = setTimeout(() => {
        finish(new Error("RCON connection timed out"));
      }, this.options.timeoutMs ?? 6000);

      this.options.onDebug?.("[RCON] WebSocket handshake started");
      this.options.onDebug?.("[RCON] WebSocket auth path sent");
      socket = new WebSocket(attempt.url, {
        handshakeTimeout: this.options.timeoutMs ?? 6000,
        followRedirects: false,
        rejectUnauthorized: attempt.rejectUnauthorized,
        headers: attempt.headers,
      });

      socket.once("open", () => {
        this.options.onDebug?.("[RCON] WebSocket connected");
        this.options.onDebug?.("[RCON] WebSocket auth success");
        settled = true;
        clearTimeout(timeout);
        this.attachSocket(socket);
        resolve();
      });

      socket.once("unexpected-response", (_request, response) => {
        const statusLine = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`;
        this.options.onDebug?.(`[RCON] WebSocket handshake failed: ${statusLine}`);
        if (response.statusCode === 401) {
          this.options.onDebug?.("[RCON] WebSocket auth failed");
        }
        finish(new Error(`Unexpected server response: ${response.statusCode}`));
      });

      socket.once("error", (error) => finish(error instanceof Error ? error : new Error("WebRCON connection failed")));
    });
  }

  private attachSocket(socket: WebSocket) {
    this.socket = socket;

    socket.on("message", (data) => {
      const text = data.toString();
      this.options.onDebug?.("[RCON] Response received");
      try {
        const message = JSON.parse(text) as RconMessage;
        this.options.onMessage?.(message);
        const pending = this.pending.get(message.Identifier);
        if (pending) {
          this.pending.delete(message.Identifier);
          pending.resolve(message);
        }
      } catch {
        this.options.onMessage?.(text);
      }
    });

    socket.on("close", () => {
      if (this.socket !== socket) {
        return;
      }

      for (const pending of this.pending.values()) {
        pending.reject(new Error("RCON connection closed"));
      }
      this.pending.clear();
      this.socket = undefined;
    });

    socket.on("error", (error) => {
      for (const pending of this.pending.values()) {
        pending.reject(error instanceof Error ? error : new Error("RCON connection failed"));
      }
      this.pending.clear();
    });
  }

  async command(command: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const identifier = this.id++;
    const payload = JSON.stringify({
      Identifier: identifier,
      Message: command,
      Name: "MyRcon",
    });

    return new Promise<RconMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(identifier);
        reject(new Error(`RCON command timed out: ${command}`));
      }, this.options.timeoutMs ?? 6000);

      this.pending.set(identifier, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.options.onDebug?.(`[RCON] Command sent: ${command}`);
      this.socket?.send(payload, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(identifier);
          reject(error);
        }
      });
    });
  }

  close() {
    if (this.socket) {
      const socket = this.socket;
      this.socket = undefined;
      socket.close();
    }
  }
}

function buildWebRconAttempts(options: RconConnectionOptions) {
  const host = `${options.host}:${options.port}`;
  const encoded = encodeURIComponent(options.password);
  const raw = options.password;
  const pathCandidates = [
    { label: "raw password path", passwordPath: raw },
    { label: "encoded password path", passwordPath: encoded },
    { label: "encoded password path with trailing slash", passwordPath: `${encoded}/` },
  ];
  const schemes = [
    { label: "ws", scheme: "ws", rejectUnauthorized: undefined },
    { label: "wss insecure", scheme: "wss", rejectUnauthorized: false },
  ];
  const handshakeProfiles: Array<{ label: string; headers?: Record<string, string> }> = [
    { label: "bare websocket" },
    { label: "Facepunch browser origin", headers: { Origin: "http://facepunch.github.io" } },
    { label: "localhost origin", headers: { Origin: "http://localhost" } },
  ];

  const seen = new Set<string>();
  const attempts: WebRconAttempt[] = [];
  for (const scheme of schemes) {
    for (const pathCandidate of pathCandidates) {
      for (const profile of handshakeProfiles) {
        const url = `${scheme.scheme}://${host}/${pathCandidate.passwordPath}`;
        const key = `${url}:${profile.label}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        attempts.push({
          label: `${scheme.label} ${pathCandidate.label}, ${profile.label}`,
          url,
          headers: profile.headers,
          rejectUnauthorized: scheme.rejectUnauthorized,
        });
      }
    }
  }

  return attempts;
}

function redactWebRconUrl(url: string) {
  return url.replace(/^(wss?:\/\/[^/]+)\/.*$/i, "$1/<password hidden>");
}

function buildFinalWebRconError(errors: Error[], attemptedShapes: string[]) {
  const wrongPassword = errors.find(
    (error) => error instanceof RconConnectionError && error.state === "wrong_password",
  );
  if (wrongPassword) {
    return wrongPassword;
  }

  const prioritized =
    errors.find((error) => error instanceof RconConnectionError && error.state === "wrong_rcon_type") ??
    errors.find((error) => error instanceof RconConnectionError && error.state === "timeout") ??
    errors.find((error) => error instanceof RconConnectionError && error.state === "port_unreachable");
  const last = prioritized ?? errors.at(-1) ?? new Error("WebRCON connection failed");
  const classified = normalizeWebRconError(last);
  if (classified instanceof RconConnectionError) {
    return new RconConnectionError(
      classified.message,
      classified.state,
      `${classified.suggestedFix ?? "Verify WebRCON settings."} Tried URL formats: ${attemptedShapes.join(", ")}.`,
    );
  }

  return classified;
}

function normalizeWebRconError(error: Error) {
  if (error.message.includes("Unexpected server response: 401")) {
    return new RconConnectionError(
      "WebRCON rejected the password.",
      "wrong_password",
      "Check the saved RCON password for this server profile.",
    );
  }

  if (
    error.message.includes("Expected HTTP/") ||
    error.message.includes("Parse Error") ||
    error.message.includes("Unexpected server response:")
  ) {
    return new RconConnectionError(
      "The RCON port did not complete a WebSocket handshake for WebRCON.",
      "wrong_rcon_type",
      "Verify this profile is set to WebRCON, the RCON port is correct, and the Rust server was launched with +rcon.web 1.",
    );
  }

  if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
    return new RconConnectionError(
      error.message,
      "port_unreachable",
      "Verify the host and RCON port are reachable from this machine.",
    );
  }

  if (
    error.message.includes("ECONNRESET") ||
    error.message.toLowerCase().includes("socket hang up")
  ) {
    return new RconConnectionError(
      "The RCON port closed the WebSocket handshake for WebRCON.",
      "wrong_password",
      "Rust's WebRCON resets the connection when the password is wrong. Verify the RCON password in your server profile matches the +rcon.password used to start the server.",
    );
  }

  if (error.message.toLowerCase().includes("timeout")) {
    return new RconConnectionError(
      error.message,
      "timeout",
      "Verify firewall rules and that the Rust server RCON listener is online.",
    );
  }

  return error;
}
