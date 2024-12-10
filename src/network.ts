import { DataConnection, Peer } from "peerjs";
import { toast } from "./toast";

interface NetworkOptions {
  name: string;
  onMessage: (data: unknown, playerID: string) => void;
  onConnect: (playerID: string) => void;
  onDisconnect: (playerID: string) => void;
}

export class Network {
  private peer: Peer;
  public playerID: string;
  public playerName: string;
  public connections: { [playerID: string]: DataConnection };
  private options: NetworkOptions;
  private connectionPromise: Promise<void>;

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
      conn.on("data", (data) => this.options.onMessage(data, conn.peer));
      conn.on("close", () => {
        toast(
          "Connection lost with the server. Please refresh the page.",
          "error"
        );
        this.connectionLost(conn.peer);
      });
      conn.on("open", () => {
        this.connections[conn.peer] = conn;
        this.options.onConnect(conn.peer);
      });
      conn.on("error", (err) => {
        toast("Error connecting to the server: " + err, "error");
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

  private connectionLost(playerID: string): void {
    delete this.connections[playerID];
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
      c.on("open", () => {
        toast("Connected to player: " + playerID, "success");
        this.connections[playerID] = c;
        resolve(c);
      });
      c.on("data", (data) => this.options.onMessage(data, playerID));
      c.on("close", () => this.connectionLost(playerID));
      c.on("error", (err) => {
        toast("Error connecting to player: " + playerID + " " + err, "error");
      });
    });
  }

  disconnectFrom(playerID: string): void {
    if (!this.peer) throw new Error("Network not started");
    toast("Disconnected from player: " + playerID, "info");
    this.connections[playerID].close();
    delete this.connections[playerID];
  }

  destroy(): void {
    if (!this.peer) throw new Error("Network not started");

    for (const playerID in this.connections) {
      this.connections[playerID].close();
    }
    this.peer.destroy();
  }
}
