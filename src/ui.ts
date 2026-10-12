import "./ui.css";

import Alpine from "alpinejs";
import { DeepReadonly } from "ts-essentials";
import { Player } from "./types";
import { GameController } from "./game";
import { MAPS } from "./maps";

type PingQuality = "local" | "good" | "ok" | "laggy" | "poor" | "wait";

type PlayerRow = {
  id: string;
  name: string;
  team: Player["team"];
  isHost: boolean;
  isYou: boolean;
  ping: number | null;
  pingLabel: string;
  pingQuality: PingQuality;
};

type HudPing = {
  label: string;
  quality: PingQuality;
  title: string;
};

type TeamGroup = {
  id: Player["team"];
  label: string;
  players: PlayerRow[];
};

const TEAMS: { id: Player["team"]; label: string }[] = [
  { id: "red", label: "Red" },
  { id: "blue", label: "Blue" },
  { id: "spectator", label: "Spectators" },
];

export class UI {
  constructor(controller: DeepReadonly<GameController>) {
    Alpine.data("gameMenu", () => createGameMenu(controller));
    Alpine.start();
  }
}

function createGameMenu(controller: DeepReadonly<GameController>) {
  return {
    name: "",
    draftName: "",
    setupDone: false,
    nameError: "",
    scoreRed: 0,
    scoreBlue: 0,
    players: [] as PlayerRow[],
    playerID: "",
    isHost: false,
    running: false,
    inGame: false,
    joinInput: "",
    joinError: "",
    joining: false,
    copied: false,
    copyTimer: 0,
    pendingGameId: "",
    previousHostId: "",
    didAutoJoin: false,
    joinOpen: false,
    teams: TEAMS,
    maps: MAPS.map(({ id, name, blurb }) => ({ id, name, blurb })),
    mapId: "classic",

    get invited() {
      return Boolean(this.pendingGameId && this.pendingGameId !== this.playerID);
    },

    get inviteUrl() {
      const gameId =
        this.pendingGameId && this.pendingGameId !== this.playerID
          ? this.pendingGameId
          : this.playerID;
      if (!gameId) return "";
      return buildGameUrl(gameId);
    },

    get showJoin() {
      return !this.inGame;
    },

    get showCreate() {
      return !this.inGame;
    },

    get showStart() {
      return this.inGame && this.isHost && !this.running;
    },

    get showStop() {
      return this.isHost && this.running;
    },

    get showLeave() {
      return this.inGame;
    },

    get mapName() {
      return this.maps.find((map) => map.id === this.mapId)?.name ?? "Classic";
    },

    get teamGroups(): TeamGroup[] {
      const groups: TeamGroup[] = TEAMS.map((team) => ({
        id: team.id,
        label: team.label,
        players: [],
      }));
      for (const player of this.players) {
        groups.find((group) => group.id === player.team)?.players.push(player);
      }
      return groups;
    },

    get statusHint() {
      if (this.joining) return "Connecting you to the match…";
      if (this.running) return "Match in progress.";
      if (!this.inGame) return "Create a match or join a friend.";
      if (this.isHost) return "Invite friends, pick a map, then start.";
      return "Waiting for the host to start.";
    },

    get hudPing(): HudPing | null {
      if (!this.inGame) return null;
      if (this.isHost) {
        const others = this.players
          .filter((player) => !player.isYou && player.ping != null)
          .map((player) => player.ping as number);
        if (others.length === 0) {
          return this.players.some((player) => !player.isYou)
            ? { label: "…", quality: "wait", title: "Measuring ping to players" }
            : null;
        }
        const worst = Math.max(...others);
        const quality = pingQuality(worst);
        return {
          label: `${worst}ms`,
          quality,
          title: "Highest ping in the match",
        };
      }
      const host = this.players.find((player) => player.isHost);
      if (!host) return null;
      return {
        label: host.pingLabel,
        quality: host.pingQuality,
        title: "Your ping to the host",
      };
    },

    init() {
      document.getElementById("boot")?.remove();

      const saved = localStorage.getItem("name")?.trim() || "";
      this.name = saved;
      this.draftName = saved;
      this.setupDone = saved.length > 0;
      this.pendingGameId = parseGameId(
        new URLSearchParams(window.location.search).get("game") || "",
      );
      this.previousHostId = sessionStorage.getItem("hostGameId") || "";

      if (saved) {
        controller.changeName(controller.getPlayerID(), saved);
      }

      this.sync();
      this.tryAutoJoin();
      setInterval(() => {
        this.sync();
        this.tryAutoJoin();
      }, 500);
    },

    sync() {
      this.playerID = controller.getPlayerID();
      this.scoreRed = controller.game.score.red;
      this.scoreBlue = controller.game.score.blue;
      this.isHost = controller.isHost();
      this.running = controller.isRunning();
      this.inGame = controller.game.players.length > 0;
      this.mapId = controller.game.mapId;
      this.players = controller.game.players.map((player, index) => {
        const isYou = player.id === this.playerID;
        const ping = controller.getPing(player.id);
        const quality = pingQuality(ping, isYou);
        return {
          id: player.id,
          name: player.name,
          team: player.team,
          isHost: index === 0,
          isYou,
          ping,
          pingLabel: pingLabel(ping, isYou),
          pingQuality: quality,
        };
      });
    },

    completeSetup() {
      const name = this.draftName.trim();
      if (!name) {
        this.nameError = "Enter a name to continue";
        return;
      }

      this.nameError = "";
      this.name = name;
      localStorage.setItem("name", name);
      controller.changeName(controller.getPlayerID(), name);
      this.setupDone = true;
      this.tryAutoJoin();
    },

    saveName() {
      const name = this.name.trim();
      if (!name) {
        this.name = localStorage.getItem("name") || this.draftName;
        return;
      }

      localStorage.setItem("name", name);
      controller.changeName(controller.getPlayerID(), name);
    },

    createMatch() {
      if (!this.name.trim()) return;
      controller.createMatch();
      this.sync();
    },

    selectMap(mapId: string) {
      if (!this.isHost || this.running) return;
      controller.selectMap(mapId);
      this.sync();
    },

    start() {
      if (!this.name.trim()) return;
      controller.start();
      this.sync();
    },

    stop() {
      controller.stop();
      this.sync();
    },

    leave() {
      controller.leaveMatch();
      this.pendingGameId = this.playerID;
      this.previousHostId = this.playerID;
      sessionStorage.setItem("hostGameId", this.playerID);
      setGameQuery(this.playerID);
      this.didAutoJoin = true;
      this.joinOpen = false;
      this.joinError = "";
      this.sync();
    },

    changeTeam(playerID: string, team: Player["team"]) {
      controller.changeTeam(playerID, team);
    },

    kickPlayer(playerID: string) {
      controller.kickPlayer(playerID);
    },

    async joinFromInput() {
      const gameId = parseGameId(this.joinInput);
      if (!gameId) {
        this.joinOpen = true;
        this.joinError = "Paste an invite link to join";
        return;
      }
      this.joinOpen = true;
      await this.joinGame(gameId);
    },

    async joinGame(gameId: string) {
      if (!gameId || this.joining) return;
      if (gameId === this.playerID) {
        this.joinError = "That's your own invite link";
        return;
      }
      if (!this.name.trim()) {
        this.joinError = "Enter a name before joining";
        return;
      }

      this.joinError = "";
      this.joining = true;
      this.pendingGameId = gameId;
      sessionStorage.removeItem("hostGameId");
      setGameQuery(gameId);

      try {
        await controller.joinPlayer(gameId);
        this.joinInput = "";
      } catch {
        this.joinError = "Couldn't join that game. Check the link and try again.";
      } finally {
        this.joining = false;
      }
    },

    tryAutoJoin() {
      if (this.didAutoJoin || !this.setupDone || this.joining) return;
      if (!this.playerID || !this.name.trim()) return;

      const shouldJoin =
        Boolean(this.pendingGameId) &&
        this.pendingGameId !== this.playerID &&
        this.pendingGameId !== this.previousHostId;

      this.didAutoJoin = true;
      if (!shouldJoin) {
        sessionStorage.setItem("hostGameId", this.playerID);
        setGameQuery(this.playerID);
        return;
      }

      void this.joinGame(this.pendingGameId);
    },

    markCopied() {
      this.copied = true;
      window.clearTimeout(this.copyTimer);
      this.copyTimer = window.setTimeout(() => {
        this.copied = false;
      }, 2000);
    },

    async copyInvite() {
      if (!this.inviteUrl) return;

      try {
        await navigator.clipboard.writeText(this.inviteUrl);
        this.markCopied();
        return;
      } catch {
        // Clipboard API can be blocked; fall back to a selected input.
      }

      const input = document.createElement("textarea");
      input.value = this.inviteUrl;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      try {
        if (document.execCommand("copy")) this.markCopied();
      } catch {
        // User can share the current page URL instead.
      } finally {
        input.remove();
      }
    },
  };
}

function pingQuality(ms: number | null, isYou = false): PingQuality {
  if (isYou) return "local";
  if (ms == null) return "wait";
  if (ms < 80) return "good";
  if (ms < 150) return "ok";
  if (ms < 250) return "laggy";
  return "poor";
}

function pingLabel(ms: number | null, isYou: boolean): string {
  if (isYou) return "local";
  if (ms == null) return "…";
  return `${ms}ms`;
}

function parseGameId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed, window.location.href);
    const fromQuery = url.searchParams.get("game")?.trim();
    if (fromQuery) return fromQuery;

    const fromHash = new URLSearchParams(url.hash.replace(/^#/, ""))
      .get("game")
      ?.trim();
    if (fromHash) return fromHash;
  } catch {
    return trimmed;
  }

  return trimmed;
}

function buildGameUrl(gameId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("game", gameId);
  url.hash = "";
  return url.toString();
}

function setGameQuery(gameId: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("game") === gameId) return;
  url.searchParams.set("game", gameId);
  history.replaceState(null, "", url);
}
