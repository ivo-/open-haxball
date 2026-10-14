import { Network } from "./network";
import { Physics } from "./physics";
import { initialKeyboard, onKeyboard } from "./keyboard";
import { Action, Game, GoalHandler, Player, Snapshot } from "./types";
import { getMap, isMapId } from "./maps";
import { SYNC_WORLDS_INTERVAL } from "./config";
import { toast } from "./toast";

// TODO:
//
// - [ ] Add game rooms with supabase
// - [ ] Allow create/delete games
// - [ ] Create a proper UI
//

export class GameController {
  public game: Game;
  public physics: Physics;
  public network: Network;
  private syncWorldsInterval: number = 0;

  constructor() {
    this.game = {
      mapId: "classic",
      gameMap: getMap("classic"),
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
      this.isHost,
      this.getLocalPlayerName,
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
    toast("A player joined", "success");

    // First player to connect makes the current player the host.
    if (this.game.players.length === 0) {
      this.game.players.push(
        createPlayer(this.network.playerID, this.network.playerName),
        createPlayer(playerID),
      );

      this.broadcastGame();
      return;
    }

    if (!this.isHost()) return;
    this.game.players.push(createPlayer(playerID));
    this.broadcastGame();
  };

  handleDisconnect = (playerID: string) => {
    const wasHost = this.game.players[0]?.id === playerID;
    const index = this.game.players.findIndex((p) => p.id === playerID);
    if (index === -1) return;
    const playerName = this.game.players[index].name;
    this.game.players.splice(index, 1);
    toast(`${playerName} left the match`, "info");

    if (wasHost) {
      this.handleMatchEnded();
      return;
    }

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
      case "leaveMatch":
        this.handleMatchEnded();
        break;
      case "identify":
        if (!player) return;
        if (!this.isHost()) return;
        const sameNamePlayer = this.game.players.filter(
          (p) => p.name === action.name && p.id !== playerID,
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
        this.game.gameMap = getMap(this.game.mapId);
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

  createMatch() {
    if (this.game.players.length === 0) {
      this.game.players.push(
        createPlayer(this.network.playerID, this.network.playerName),
      );
    }

    if (this.isHost()) {
      this.broadcastGame();
    }
  }

  start() {
    if (this.physics.isRunning()) return;
    this.createMatch();
    this.game.score = { red: 0, blue: 0 };
    this.game.players.forEach((player) => {
      player.keyboard = { ...initialKeyboard };
    });

    onKeyboard((keyboard) => {
      const player = this.game.players.find(
        (p) => p.id === this.network.playerID,
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
    this.halt();
    if (this.isHost()) {
      this.network.broadcast({ type: "stopGame" });
    }
  }

  leaveMatch() {
    const isHost = this.isHost();
    this.halt();
    if (isHost) {
      this.network.broadcast({ type: "leaveMatch" });
    }
    this.network.disconnectAll();
    this.resetMatchState();
  }

  private handleMatchEnded() {
    this.halt();
    this.network.disconnectAll();
    this.resetMatchState();
  }

  private halt() {
    clearInterval(this.syncWorldsInterval);
    onKeyboard(() => {});
    this.physics.stop();
  }

  private resetMatchState() {
    this.game.players = [];
    this.game.score = { red: 0, blue: 0 };
  }

  getPlayerID() {
    return this.network.playerID;
  }

  getLocalPlayerName = () => {
    const local = this.game.players.find(
      (player) => player.id === this.network.playerID,
    );
    return local?.name ?? this.network.playerName;
  };

  getPing(playerID: string): number | null {
    return this.network.getPing(playerID);
  }

  isRunning() {
    return this.physics.isRunning();
  }

  selectMap(mapId: string) {
    if (!this.isHost() || this.isRunning()) return;
    if (!isMapId(mapId) || this.game.mapId === mapId) return;

    this.game.mapId = mapId;
    this.game.gameMap = getMap(mapId);
    this.broadcastGame();
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
