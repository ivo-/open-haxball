import "./ui.css";

import deepEqual from "fast-deep-equal";
import { DeepReadonly } from "ts-essentials";
import { Player } from "./types";
import { GameController } from "./game";

export class UI {
  private menu: HTMLElement;
  private scoreRed: HTMLElement;
  private scoreBlue: HTMLElement;
  private startButton: HTMLElement;
  private stopButton: HTMLElement;
  private leaveButton: HTMLElement;
  private controlsSeparator: HTMLElement;
  private joinGameField: HTMLElement;
  private joinGameButton: HTMLElement;
  private joinGameInput: HTMLInputElement;
  private playersList: HTMLElement;
  private currentPlayerID: HTMLElement;
  private currentPlayerName: HTMLElement;
  private state: ReturnType<typeof this.getUIState> = {} as any;
  private controller: DeepReadonly<GameController>;

  constructor(controller: DeepReadonly<GameController>) {
    this.controller = controller;

    this.menu = document.getElementById("menu")!;
    this.initializeHTML();

    this.scoreRed = document.getElementById("red-score")!;
    this.scoreBlue = document.getElementById("blue-score")!;
    this.startButton = document.getElementById("start-game")!;
    this.stopButton = document.getElementById("stop-game")!;
    this.leaveButton = document.getElementById("leave-game")!;
    this.controlsSeparator = document.getElementById("controls-separator")!;
    this.joinGameField = document.getElementById("join-game")!;
    this.joinGameButton = this.joinGameField.querySelector("button")!;
    this.joinGameInput = this.joinGameField.querySelector(
      "input"
    )! as HTMLInputElement;
    this.playersList = document.getElementById("player-list")!;
    this.currentPlayerID = document.getElementById("current-player-id")!;
    this.currentPlayerName = document.getElementById("current-player-name")!;

    this.bindEvents();

    // Update current player name.
    controller.changeName(controller.getPlayerID(), this.getPlayerName());

    // Start refresh loop
    this.refresh();
    setInterval(() => this.refresh(), 500);

    // DEBUG: Start the game directly
    // this.controller.start();
  }

  private initializeHTML() {
    const menuHTML = `
      <h2 class="title is-5 score is-flex is-flex-direction-row is-align-items-center is-justify-content-center">
        <span class="team-color red-team"></span><span id="red-score">0</span>
        <span class="ml-1 mr-1">vs</span>
        <span class="team-color blue-team"></span><span id="blue-score">0</span>
      </h2>
      <div class="content">
        <ul id="player-list" style="list-style-type: none;">
        </ul>
      </div>
      <div class="content">
        <div class="buttons is-flex is-flex-direction-column is-align-items-center is-justify-content-center">
          <button id="start-game" class="button is-primary is-small">Start Game</button>
          <button id="stop-game" class="button is-danger is-small is-hidden">Stop Game</button>
          <button id="leave-game" class="button is-warning is-small is-hidden">Leave Game</button>
          <span id="controls-separator" class="is-size-6 mx-2">or</span>
          <div id="join-game" class="field has-addons">
            <div class="control is-expanded">
              <input class="input is-small" type="text" placeholder="Enter game code">
            </div>
            <div class="control">
              <button class="button is-link is-small">Join</button>
            </div>
          </div>
        </div>
      </div>
      <footer class="card-footer is-flex-direction-column">
        <p class="footer-text">
          Your Name: <strong id="current-player-name"></strong>
          <span id="change-name-icon" class="icon is-small ml-1 is-clickable">
            <i class="fas fa-edit"></i>
          </span>
        </p>
        <p class="footer-text">Your Player ID: <strong id="current-player-id"></strong></p>
      </footer>
    `;
    const menu = document.getElementById("menu")!;
    menu.innerHTML = menuHTML;
  }

  private bindEvents() {
    this.startButton.onclick = () => this.controller.start();
    this.stopButton.onclick = () => this.controller.stop();
    this.leaveButton.onclick = () => window.location.reload();
    this.joinGameButton.onclick = this.handleJoinGame;
    this.menu.onclick = this.handleMenuClick;
    const changeNameIcon = document.getElementById("change-name-icon")!;
    changeNameIcon.onclick = this.requestPlayerName;
  }

  private handleJoinGame = () => {
    const gameID = this.joinGameInput.value;
    if (!gameID) {
      alert("Please enter a game ID");
      return;
    }
    this.joinGameInput.value = "";
    this.controller.joinPlayer(gameID);
  };

  private handleMenuClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const playerID = (target.closest("[data-player-id]") as HTMLElement)
      ?.dataset.playerId;
    if (!playerID) return;

    if (target.classList.contains("remove-button")) {
      this.controller.kickPlayer(playerID);
      return;
    }

    if (target.classList.contains("team-color")) {
      const team = target.classList[1].split("-")[0] as Player["team"];
      if (!team) return;
      this.controller.changeTeam(playerID, team);
    }
  };

  private getUIState() {
    return {
      playerID: this.controller.getPlayerID(),
      scoreRed: this.controller.game.score.red,
      scoreBlue: this.controller.game.score.blue,
      players: this.controller.game.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
      })),
      isHost: this.controller.isHost(),
      running: this.controller.isRunning(),
    };
  }

  private refresh() {
    this.currentPlayerID.textContent = this.controller.getPlayerID();
    this.currentPlayerName.textContent = this.getPlayerName();

    const oldState = this.state;
    const newState = this.getUIState();
    if (deepEqual(oldState, newState)) return;
    this.state = newState;

    this.updateScores();
    this.updateVisibility();

    if (deepEqual(oldState.players, newState.players)) return;
    this.updatePlayerList();
  }

  private updateScores() {
    this.scoreRed.textContent = this.controller.game.score.red.toString();
    this.scoreBlue.textContent = this.controller.game.score.blue.toString();
  }

  private updateVisibility() {
    const { game } = this.controller;

    if (game.players.length === 0) {
      hide(this.stopButton);
      hide(this.leaveButton);
      show(this.startButton);
      show(this.joinGameField);
      show(this.controlsSeparator);
    } else if (this.controller.isHost()) {
      hide(this.joinGameField);
      hide(this.controlsSeparator);
      hide(this.leaveButton);

      if (this.controller.isRunning()) {
        show(this.stopButton);
        hide(this.startButton);
      } else {
        hide(this.stopButton);
        show(this.startButton);
      }
    } else {
      hide(this.controlsSeparator);
      hide(this.joinGameField);
      hide(this.startButton);
      hide(this.stopButton);
      show(this.leaveButton);
    }
  }

  private updatePlayerList() {
    this.playersList.innerHTML = this.state.players
      .map((p) =>
        this.getPlayerHTML(p, this.controller.game.players[0].id === p.id)
      )
      .join("");
  }

  private getPlayerHTML(
    player: Pick<Player, "id" | "name" | "team">,
    isPlayerHost: boolean
  ) {
    return `
      <li>
        <div data-player-id="${
          player.id
        }" class="is-flex is-align-items-center">
          <div class="dropdown is-hoverable">
            <div class="dropdown-trigger">
              <span class="team-color ${
                player.team
              }-team" aria-haspopup="true"></span>
            </div>
            ${
              this.controller.isHost()
                ? `
                  <div class="dropdown-menu" role="menu">
                    <div class="dropdown-content">
                      <a class="dropdown-item">
                        <span class="team-color red-team"></span> Red Team
                      </a>
                      <a class="dropdown-item">
                        <span class="team-color blue-team"></span> Blue Team
                      </a>
                      <a class="dropdown-item">
                        <span class="team-color spectator-team"></span> Spectators
                      </a>
                    </div>
                  </div>`
                : ""
            }
          </div>
          <span class="ml-2"><strong>${player.name.substring(0, 10)}</strong> ${
      isPlayerHost ? "(host)" : ""
    }</span>
          ${
            !this.controller.isHost() || isPlayerHost
              ? ""
              : `<button class="remove-button ml-auto">&times;</button>`
          }
        </div>
      </li>
    `;
  }

  private getPlayerName() {
    let name: string = localStorage.getItem("name") || "";
    if (!name) name = this.requestPlayerName();
    return name;
  }

  private requestPlayerName = () => {
    let name = "";
    while (!name) {
      name = prompt("Enter your name:", name) || "";
      localStorage.setItem("name", name);
    }
    return name;
  };
}

const hide = (el: HTMLElement) => {
  el.classList.add("is-hidden");
};

const show = (el: HTMLElement) => {
  el.classList.remove("is-hidden");
};
