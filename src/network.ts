import { DataConnection, Peer } from "peerjs";

interface NetworkOptions {
  name: string;
  onError: (err: any) => void;
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
      this.options.onError(err);
      console.error(err);
    });

    this.peer.on("disconnected", () => {
      console.error("Disconnected from peer server");
      this.options.onError(new Error("Disconnected from peer server"));
    });

    this.peer.on("connection", (conn) => {
      this.connections[conn.peer] = conn;
      conn.on("data", (data) => this.options.onMessage(data, conn.peer));
      conn.on("close", () => this.connectionLost(conn.peer));
      conn.on("open", () => {
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
        console.log("Connected to player: ", playerID);
        this.connections[playerID] = c;
        resolve(c);
      });
      c.on("data", (data) => this.options.onMessage(data, playerID));
      c.on("close", () => this.connectionLost(playerID));
    });
  }

  disconnectFrom(playerID: string): void {
    if (!this.peer) throw new Error("Network not started");
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
