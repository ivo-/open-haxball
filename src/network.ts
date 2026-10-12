import { DataConnection, Peer } from "peerjs";
import { PING_INTERVAL } from "./config";
import { toast } from "./toast";

interface NetworkOptions {
  name: string;
  onMessage: (data: unknown, playerID: string) => void;
  onConnect: (playerID: string) => void;
  onDisconnect: (playerID: string) => void;
}

type PingMessage = { type: "ping"; t: number };
type PongMessage = { type: "pong"; t: number };

export class Network {
  private peer: Peer;
  public playerID: string;
  public playerName: string;
  public connections: { [playerID: string]: DataConnection };
  private options: NetworkOptions;
  private connectionPromise: Promise<void>;
  private ignoringDisconnects = false;
  private rtts: { [playerID: string]: number } = {};
  private pingTimer = 0;

  constructor(options: NetworkOptions) {
    this.options = options;
    this.playerName = options.name;
    this.connections = {};

    this.peer = new Peer();

    this.peer.on("error", (err) => {
      toast("Error connecting to the server: " + err, "error");
    });

    this.peer.on("disconnected", () => {
      toast("Disconnected from peer server", "error");
    });

    this.peer.on("connection", (conn) => {
      this.watchConnection(conn, (err) => {
        toast("Error connecting to the server: " + err, "error");
      });
      conn.on("open", () => {
        this.connections[conn.peer] = conn;
        this.ensurePingLoop();
        this.pingPeer(conn.peer);
        this.options.onConnect(conn.peer);
      });
    });

    this.playerID = "";
    this.connectionPromise = new Promise((resolve) => {
      this.peer?.on("open", (id) => {
        this.playerID = id;
        resolve();
      });
    });
  }

  async waitForConnection(): Promise<void> {
    await this.connectionPromise;
  }

  getPing(playerID: string): number | null {
    if (playerID === this.playerID) return 0;
    return playerID in this.rtts ? this.rtts[playerID] : null;
  }

  private connectionLost(playerID: string): void {
    delete this.connections[playerID];
    delete this.rtts[playerID];
    if (Object.keys(this.connections).length === 0) {
      this.stopPingLoop();
    }
    if (this.ignoringDisconnects) return;
    this.options.onDisconnect(playerID);
  }

  broadcast(data: unknown): void {
    for (const playerID in this.connections) {
      this.connections[playerID].send(data);
    }
  }

  connectTo(playerID: string): Promise<DataConnection> {
    if (!this.peer) throw new Error("Network not started");

    return new Promise((resolve) => {
      const c = this.peer!.connect(playerID);
      this.watchConnection(c, () => {
        toast("Couldn't join that match. Check the invite link.", "error");
      });
      c.on("open", () => {
        toast("Connected to the match", "success");
        this.connections[playerID] = c;
        this.ensurePingLoop();
        this.pingPeer(playerID);
        resolve(c);
      });
    });
  }

  disconnectFrom(playerID: string): void {
    if (!this.peer) throw new Error("Network not started");
    this.connections[playerID].close();
    delete this.connections[playerID];
    delete this.rtts[playerID];
    if (Object.keys(this.connections).length === 0) {
      this.stopPingLoop();
    }
  }

  disconnectAll(): void {
    this.ignoringDisconnects = true;
    this.stopPingLoop();
    for (const playerID of Object.keys(this.connections)) {
      this.connections[playerID].close();
      delete this.connections[playerID];
    }
    this.rtts = {};
    this.ignoringDisconnects = false;
  }

  destroy(): void {
    if (!this.peer) throw new Error("Network not started");

    this.stopPingLoop();
    for (const playerID in this.connections) {
      this.connections[playerID].close();
    }
    this.peer.destroy();
  }

  private watchConnection(
    conn: DataConnection,
    onError: (err: Error) => void,
  ): void {
    conn.on("data", (data) => this.onData(data, conn.peer));
    conn.on("close", () => {
      this.connectionLost(conn.peer);
    });
    conn.on("error", onError);
  }

  private onData(data: unknown, playerID: string): void {
    if (isPingMessage(data)) {
      this.connections[playerID]?.send({ type: "pong", t: data.t });
      return;
    }
    if (isPongMessage(data)) {
      const sample = Math.max(0, performance.now() - data.t);
      const prev = this.rtts[playerID];
      this.rtts[playerID] =
        prev == null ? Math.round(sample) : Math.round(prev * 0.65 + sample * 0.35);
      return;
    }
    this.options.onMessage(data, playerID);
  }

  private ensurePingLoop(): void {
    if (this.pingTimer) return;
    this.pingTimer = window.setInterval(() => {
      for (const playerID of Object.keys(this.connections)) {
        this.pingPeer(playerID);
      }
    }, PING_INTERVAL);
  }

  private stopPingLoop(): void {
    if (!this.pingTimer) return;
    window.clearInterval(this.pingTimer);
    this.pingTimer = 0;
  }

  private pingPeer(playerID: string): void {
    const conn = this.connections[playerID];
    if (!conn?.open) return;
    conn.send({ type: "ping", t: performance.now() });
  }
}

function isPingMessage(data: unknown): data is PingMessage {
  return isRecord(data) && data.type === "ping" && typeof data.t === "number";
}

function isPongMessage(data: unknown): data is PongMessage {
  return isRecord(data) && data.type === "pong" && typeof data.t === "number";
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}
