import { Network } from "./network";
import { Physics } from "./physics";
import { initialKeyboard, onKeyboard } from "./keyboard";
import { Action, Game, GoalHandler, Player, Snapshot } from "./types";
import classicMap from "./gameMapClassic";
import { SYNC_WORLDS_INTERVAL } from "./config";
import { toast } from "./toast";

export class GameController {
  public game: Game;
  public physics: Physics;
  public network: Network;
  private syncWorldsInterval: number = 0;

  constructor() {
    this.game = {
      gameMap: classicMap,
      players: [],
      scoreLimit: 5,
      score: {
        red: 0,
        blue: 0,
      },
    };

    this.physics = new Physics(
      this.game,
      "#app",
      this.handleGoal,
      this.handleSync,
      this.isHost
    );

    this.network = new Network({
      name: "", // Will be set later by the UI.
      onMessage: this.handleMessage,
      onConnect: this.handleConnect,
      onDisconnect: this.handleDisconnect,
    });
  }

  async init() {
    await this.network.waitForConnection();
    toast("Connected to server", "info");
  }

  handleConnect = (playerID: string) => {
    toast("Connected to player: " + playerID, "success");

    // First player to connect makes the current player the host.
    if (this.game.players.length === 0) {
      this.game.players.push(
        createPlayer(this.network.playerID, this.network.playerName),
        createPlayer(playerID)
      );

      this.broadcastGame();
      return;
    }

    if (!this.isHost()) return;
    this.game.players.push(createPlayer(playerID));
    this.broadcastGame();
  };

  handleDisconnect = (playerID: string) => {
    const index = this.game.players.findIndex((p) => p.id === playerID);
    if (index !== -1) {
      this.game.players.splice(index, 1);
    }
    // TODO: Handle the case when host kicked the player.

    this.broadcastGame();
  };

  handleMessage = (data: unknown, playerID: string) => {
    const action = data as Action;
    if (!action || !action.type) return;

    const player = this.game.players.find((p) => p.id === playerID);
    switch (action.type) {
      case "startGame":
        this.start();
        break;
      case "stopGame":
        this.stop();
        break;
      case "identify":
        if (!player) return;
        if (!this.isHost()) return;
        const sameNamePlayer = this.game.players.filter(
          (p) => p.name === action.name && p.id !== playerID
        );
        if (sameNamePlayer.length > 0) {
          player.name = action.name + `(${sameNamePlayer.length})`;
        } else {
          player.name = action.name;
        }
        this.broadcastGame();
        break;
      case "updateGame":
        Object.assign(this.game, action.game);
        this.game.players.forEach((player) => {
          if (player.id === this.network.playerID) return;
          if (this.network.connections[player.id]) return;
          this.network.connectTo(player.id);
        });
        break;
      case "updateKeyboard":
        if (!player) return;
        player.keyboard = action.keyboard;
        break;
      case "gameSnapshot":
        this.physics.applySnapshot(action.snapshot as Snapshot);
        break;
    }
  };

  handleGoal: GoalHandler = (team) => {
    if (!this.isHost()) {
      return;
    }

    if (team === "red") {
      this.game.score.red++;
    } else {
      this.game.score.blue++;
    }
    this.game.players.forEach((player) => {
      player.keyboard = { ...initialKeyboard };
    });
    this.broadcastGame();

    if (
      this.game.score.red >= this.game.scoreLimit ||
      this.game.score.blue >= this.game.scoreLimit
    ) {
      this.game.score = { red: 0, blue: 0 };
      this.stop();
      return;
    }
  };

  handleSync = () => {
    this.broadcastSnapshot();
  };

  isHost = () => {
    return this.game.players[0]?.id === this.network.playerID;
  };

  broadcastGame() {
    this.network.broadcast({ type: "updateGame", game: this.game });
  }

  broadcastSnapshot() {
    if (!this.physics.isRunning()) return;
    if (!this.isHost()) return;

    this.network.broadcast({
      type: "gameSnapshot",
      snapshot: this.physics.getSnapshot(),
    });
  }

  start() {
    if (this.game.players.length === 0) {
      this.game.players.push(
        createPlayer(this.network.playerID, this.network.playerName)
      );
    }

    onKeyboard((keyboard) => {
      const player = this.game.players.find(
        (p) => p.id === this.network.playerID
      );
      if (!player || player.team === "spectator") return;

      player.keyboard = keyboard;

      this.network.broadcast({ type: "updateKeyboard", keyboard });
    });

    this.syncWorldsInterval = setInterval(() => {
      this.broadcastSnapshot();
    }, SYNC_WORLDS_INTERVAL);

    this.physics.start();

    if (this.isHost()) {
      this.broadcastGame();
      this.network.broadcast({ type: "startGame" });
    }
  }

  stop() {
    clearInterval(this.syncWorldsInterval);
    onKeyboard(() => {});

    this.physics.stop();
    if (this.isHost()) {
      this.network.broadcast({ type: "stopGame" });
    }
  }

  getPlayerID() {
    return this.network.playerID;
  }

  isRunning() {
    return this.physics.isRunning();
  }

  changeTeam(playerID: string, team: Player["team"]) {
    const player = this.game.players.find((p) => p.id === playerID);
    if (!player) return;
    if (player.team === team) return;

    player.team = team;
    this.broadcastGame();
  }
  changeName(playerID: string, name: string) {
    if (this.game.players.length === 0) {
      if (playerID === this.network.playerID) {
        this.network.playerName = name;
      }

      return;
    }

    const player = this.game.players.find((p) => p.id === playerID);
    if (!player) return;
    if (player.name === name) return;

    player.name = name;
    this.broadcastGame();
  }

  kickPlayer(playerID: string) {
    const index = this.game.players.findIndex((p) => p.id === playerID);
    if (index === -1) return;
    this.game.players.splice(index, 1);
    this.broadcastGame();
    this.network.disconnectFrom(playerID);
  }

  async joinPlayer(playerID: string) {
    await this.network.connectTo(playerID);
    this.network.broadcast({ type: "identify", name: this.network.playerName });
  }
}

export const createPlayer = (id: string, name: string = "Player " + id) => ({
  id,
  name: name,
  team: "spectator" as const,
  keyboard: { ...initialKeyboard },
});

export const splitTeams = (game: Game) => {
  game.players.forEach((player, i) => {
    player.team = i % 2 === 0 ? "red" : "blue";
  });
};
