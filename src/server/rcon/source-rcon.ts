import net from "node:net";

const SERVERDATA_RESPONSE_VALUE = 0;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_AUTH = 3;

export type SourceRconOptions = {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
};

type PendingRequest = {
  mode: "auth" | "command";
  chunks: string[];
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class SourceRconClient {
  private socket?: net.Socket;
  private buffer = Buffer.alloc(0);
  private id = 1;
  private pending = new Map<number, PendingRequest>();

  constructor(private options: SourceRconOptions) {}

  connect() {
    return new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: this.options.host,
        port: this.options.port,
      });

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Legacy RCON connection timed out"));
      }, this.options.timeoutMs ?? 8000);

      socket.once("connect", async () => {
        clearTimeout(timeout);
        this.socket = socket;
        try {
          await this.auth();
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Legacy RCON authentication failed"));
        }
      });

      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socket.on("data", (chunk) => this.receive(chunk));
      socket.on("close", () => {
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Legacy RCON connection closed"));
        }
        this.pending.clear();
      });
    });
  }

  async command(command: string) {
    if (!this.socket || this.socket.destroyed) {
      await this.connect();
    }

    return this.sendCommand(SERVERDATA_EXECCOMMAND, command);
  }

  close() {
    this.socket?.end();
  }

  private async auth() {
    const responseId = await this.sendCommand(SERVERDATA_AUTH, this.options.password, "auth");
    if (Number(responseId) === -1) {
      throw new Error("Legacy RCON rejected the password. Check the saved RCON password.");
    }
  }

  private sendCommand(type: number, body: string, mode: "auth" | "command" = "command") {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Legacy RCON socket is not connected");
    }

    const id = this.id++;
    const packet = encodePacket({ id, type, body });

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(mode === "auth" ? "Legacy RCON authentication timed out" : "Legacy RCON command timed out"));
      }, this.options.timeoutMs ?? 8000);

      this.pending.set(id, {
        mode,
        chunks: [],
        resolve,
        reject,
        timeout,
      });

      this.socket?.write(packet);
    });
  }

  private receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (this.buffer.length < size + 4) {
        return;
      }

      const packetBuffer = this.buffer.subarray(4, size + 4);
      this.buffer = this.buffer.subarray(size + 4);

      const packet = decodePacket(packetBuffer);
      const pending = this.pending.get(packet.id);
      if (!pending) {
        continue;
      }

      if (pending.mode === "auth") {
        if (packet.type === SERVERDATA_AUTH_RESPONSE) {
          clearTimeout(pending.timeout);
          this.pending.delete(packet.id);
          if (packet.id === -1) {
            pending.reject(new Error("Legacy RCON rejected the password. Check the saved RCON password."));
          } else {
            pending.resolve(String(packet.id));
          }
        }
        continue;
      }

      if (packet.type === SERVERDATA_RESPONSE_VALUE) {
        if (packet.body.length === 0) {
          clearTimeout(pending.timeout);
          this.pending.delete(packet.id);
          pending.resolve(pending.chunks.join(""));
        } else {
          pending.chunks.push(packet.body);
        }
        continue;
      }

      if (packet.type === SERVERDATA_AUTH_RESPONSE) {
        clearTimeout(pending.timeout);
        this.pending.delete(packet.id);
        pending.resolve(packet.body);
      }
    }
  }
}

function encodePacket(packet: { id: number; type: number; body: string }) {
  const body = Buffer.from(packet.body, "utf8");
  const size = 4 + 4 + body.length + 2;
  const buffer = Buffer.alloc(size + 4);
  buffer.writeInt32LE(size, 0);
  buffer.writeInt32LE(packet.id, 4);
  buffer.writeInt32LE(packet.type, 8);
  body.copy(buffer, 12);
  buffer.writeInt8(0, 12 + body.length);
  buffer.writeInt8(0, 13 + body.length);
  return buffer;
}

function decodePacket(buffer: Buffer) {
  const id = buffer.readInt32LE(0);
  const type = buffer.readInt32LE(4);
  const body = buffer.subarray(8, Math.max(8, buffer.length - 2)).toString("utf8");
  return { id, type, body };
}
