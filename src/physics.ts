import { DeepReadonly } from "ts-essentials";
import {
  Render,
  Engine,
  Bodies,
  Body,
  Composite,
  Runner,
  Events,
  World,
} from "matter-js";
import {
  Game,
  GoalHandler,
  Player,
  Snapshot,
  SnapshotCoordinates,
} from "./types";
import {
  BALL_RADIUS,
  PLAYER_RADIUS,
  COLLISION_FILTER_DEFAULT,
  COLLISION_FILTER_GOAL_LINE,
  COLLISION_FILTER_BALL,
  COLLISION_FILTER_PLAYER,
  MIN_FORCE_APPLY_INTERVAL,
  MOVEMENT_VELOCITY_CHANGE,
  PLAYER_POWER_KICK_RADIUS,
  BALL_FORCE_MULTIPLIER,
  PHYSICS_RUNNER_INTERVAL,
  PLAYER_MAX_VELOCITY,
} from "./config";
import { Keyboard } from "./keyboard";
import { DOOR_WIDTH } from "./gameMapClassic";

export type PhysicsPlayer = Body & {
  // The last time force was applied to the player. This is used to limit the
  // rate at which movement forces are applied.
  __lastForceApplyTime: number;
};

// This is a hack to allow the player ID to be a string, while Matter.js expects
// it to be a number. We use an empty string as the ID for the ball and obstacles,
// since the render draws those IDs.
const emptyID = "" as unknown as number;
const nameToID = (name: string) => name as unknown as number;

const now = () => Date.now();

export class Physics {
  private engine: Engine;
  private render: Render;
  private runner: Runner;
  private ball: Body;
  private world: World;
  private players: PhysicsPlayer[] = [];

  private game: DeepReadonly<Game>;
  private applyForcesTimer: number | null = null;
  private onGoalHandler: GoalHandler;
  private onTriggerSync: () => void;
  private isHost: () => boolean;

  constructor(
    game: DeepReadonly<Game>,
    element: string,
    onGoalHandler: GoalHandler,
    onTriggerSync: () => void,
    isHost: () => boolean
  ) {
    this.game = game;
    this.onGoalHandler = onGoalHandler;
    this.onTriggerSync = onTriggerSync;
    this.isHost = isHost;

    this.engine = Engine.create({
      gravity: { x: 0, y: 0 },
    });

    this.render = Render.create({
      element: document.querySelector<HTMLElement>(element)!,
      engine: this.engine,
      options: {
        width: game.gameMap.width,
        height: game.gameMap.height,
        showIds: true,
        wireframes: false,
      },
    });

    const { players, ball, obstacles, goalLineBlue, goalLineRed } =
      this.createGameObjects();

    Composite.add(this.engine.world, [
      goalLineBlue,
      goalLineRed,
      ...obstacles,
      ...players,
      ball,
    ]);

    this.players = players;
    this.ball = ball;
    this.world = this.engine.world;

    this.runner = Runner.create({
      // TODO: Should be fixed? Running in background?
      delta: PHYSICS_RUNNER_INTERVAL,
    });

    Events.on(this.engine, "beforeUpdate", () => {
      this.handleBoundaryCollisions();
    });
  }

  private createGameObjects() {
    const { gameMap } = this.game;

    const players = this.game.players.map((gamePlayer, i) =>
      this.gamePlayerToPhysicsPlayer(gamePlayer, i)
    );

    const ballPos = gameMap.initialPos.ball;
    const ball = Bodies.circle(ballPos.x, ballPos.y, BALL_RADIUS, {
      id: emptyID,
      restitution: 0.9,
      render: {
        fillStyle: gameMap.ballColor,
        strokeStyle: "white",
        lineWidth: 2,
      },
      collisionFilter: {
        category: COLLISION_FILTER_BALL,
        mask: COLLISION_FILTER_DEFAULT | COLLISION_FILTER_PLAYER,
      },
    });

    const circleObstacles = gameMap.obstacles
      .filter((obstacle) => "radius" in obstacle)
      .map((obstacle) => {
        const { x, y, radius, fill, stroke, collisionMask } = obstacle;
        return Bodies.circle(x, y, radius, {
          id: emptyID,
          isStatic: true,
          collisionFilter: collisionMask ? { mask: collisionMask } : {},
          render: {
            fillStyle: fill,
            strokeStyle: stroke,
            lineWidth: 2,
          },
        });
      });

    const rectangleObstacles = gameMap.obstacles
      .filter((obstacle) => "width" in obstacle)
      .map((obstacle) => {
        const {
          x,
          y,
          width,
          height,
          fill,
          stroke,
          strokeWidth,
          collisionMask,
        } = obstacle;
        return Bodies.rectangle(x + width / 2, y + height / 2, width, height, {
          id: emptyID,
          isStatic: true,
          collisionFilter: collisionMask ? { mask: collisionMask } : {},
          render: {
            fillStyle: fill,
            strokeStyle: stroke,
            lineWidth: strokeWidth,
          },
        });
      });

    const goalLineBlue = Bodies.rectangle(
      gameMap.goalLineBlue.x,
      gameMap.goalLineBlue.y +
        (gameMap.goalLineBlue.y2 - gameMap.goalLineBlue.y) / 2,
      1,
      gameMap.goalLineBlue.y2 - gameMap.goalLineBlue.y,
      {
        id: emptyID,
        isStatic: true,
        collisionFilter: {
          category: COLLISION_FILTER_GOAL_LINE,
        },
        render: {
          fillStyle: gameMap.goalLineBlue.color,
        },
      }
    );

    const goalLineRed = Bodies.rectangle(
      gameMap.goalLineRed.x,
      gameMap.goalLineRed.y +
        (gameMap.goalLineRed.y2 - gameMap.goalLineRed.y) / 2,
      1,
      gameMap.goalLineRed.y2 - gameMap.goalLineRed.y,
      {
        id: emptyID,
        isStatic: true,
        collisionFilter: {
          category: COLLISION_FILTER_GOAL_LINE,
        },
        render: {
          fillStyle: gameMap.goalLineRed.color,
        },
      }
    );

    return {
      players,
      ball,
      obstacles: [...rectangleObstacles, ...circleObstacles],
      goalLineBlue,
      goalLineRed,
    };
  }

  private gamePlayerToPhysicsPlayer(
    player: Player,
    index: number
  ): PhysicsPlayer {
    const { gameMap } = this.game;

    if (player.team === "spectator") {
      throw new Error("Cannot create a physics player for a spectator");
    }

    const possiblePositions = gameMap.initialPos[player.team];
    const position = possiblePositions[index] || possiblePositions[0];

    return Bodies.circle(position.x, position.y, PLAYER_RADIUS, {
      id: nameToID(player.name),
      collisionFilter: {
        mask:
          COLLISION_FILTER_DEFAULT |
          COLLISION_FILTER_BALL |
          COLLISION_FILTER_PLAYER,
        category: COLLISION_FILTER_PLAYER,
      },
      render: {
        fillStyle: gameMap.playerColors[player.team],
      },
    }) as PhysicsPlayer;
  }

  // TODO: Properly abstract those in the config.
  private handleBoundaryCollisions(): void {
    const { gameMap } = this.game;

    // Handle player collisions
    const playerMaxX = gameMap.width - PLAYER_RADIUS - 2;
    const playerMaxY = gameMap.height - PLAYER_RADIUS - 2;
    const playerMinX = PLAYER_RADIUS;
    const playerMinY = PLAYER_RADIUS;

    const ballMaxX = gameMap.width - BALL_RADIUS - PLAYER_RADIUS * 2;
    const ballMaxY = gameMap.height - BALL_RADIUS - PLAYER_RADIUS * 2;
    const ballMinX = BALL_RADIUS + PLAYER_RADIUS * 2;
    const ballMinY = BALL_RADIUS + PLAYER_RADIUS * 2;

    const ballPos = this.ball.position;

    // Check for goal
    const goalLineWidth = DOOR_WIDTH;
    const goalLineBlue = gameMap.goalLineBlue;
    const goalLineRed = gameMap.goalLineRed;

    if (
      ballPos.x > goalLineBlue.x &&
      ballPos.y > goalLineBlue.y &&
      ballPos.y < goalLineBlue.y2 &&
      ballPos.x < goalLineBlue.x + goalLineWidth
    ) {
      this.onGoalHandler("red");
      this.resetPositions();
      return;
    }

    if (
      ballPos.x < goalLineRed.x &&
      ballPos.y > goalLineRed.y &&
      ballPos.y < goalLineRed.y2 &&
      ballPos.x > goalLineRed.x - goalLineWidth
    ) {
      this.onGoalHandler("blue");
      this.resetPositions();
      return;
    }

    const entities: [Body, number, number, number, number][] = this.players.map(
      (p) => [p, playerMaxX, playerMaxY, playerMinX, playerMinY]
    );
    entities.push([this.ball, ballMaxX, ballMaxY, ballMinX, ballMinY]);

    entities.forEach(([entity, maxX, maxY, minX, minY]) => {
      if (entity.position.x >= maxX) {
        Body.setPosition(entity, { x: maxX, y: entity.position.y });
        Body.setVelocity(entity, {
          x: Math.min(entity.velocity.x, -0.1),
          y: entity.velocity.y,
        });
      } else if (entity.position.x <= minX) {
        Body.setPosition(entity, { x: minX + 1, y: entity.position.y });
        Body.setVelocity(entity, {
          x: Math.max(entity.velocity.x, 0.1),
          y: entity.velocity.y,
        });
      }

      if (entity.position.y >= maxY) {
        Body.setPosition(entity, { x: entity.position.x, y: maxY });
        Body.setVelocity(entity, {
          x: entity.velocity.x,
          y: Math.min(entity.velocity.y, -0.1),
        });
      } else if (entity.position.y <= minY) {
        Body.setPosition(entity, { x: entity.position.x, y: minY + 1 });
        Body.setVelocity(entity, {
          x: entity.velocity.x,
          y: Math.max(entity.velocity.y, 0.1),
        });
      }
    });
  }

  private applyAllForces(): void {
    if (!this.isRunning()) return;

    this.syncPlayers();
    for (let player of this.players) {
      const gamePlayer = this.game.players.find(
        (p) => p.name === String(player.id)
      );
      if (!gamePlayer) continue;
      const appliedForce = this.applyForces(player, gamePlayer.keyboard);
      if (appliedForce) {
        // NOTE: To reduce lag set a specific timestamp in the future
        // to apply the forces and broadcast the vector with the timestamp.
        this.onTriggerSync();
      }
    }
  }

  private syncPlayers(): void {
    const { players: gamePlayers, gameMap } = this.game;

    const newPlayers = gamePlayers.filter(
      (player) =>
        !this.players.some((p) => String(p.id) === player.name) &&
        player.team !== "spectator"
    );

    const playersToRemove = this.players.filter(
      (player) =>
        !gamePlayers.some(
          (p) => p.name === String(player.id) && p.team !== "spectator"
        )
    );

    newPlayers.forEach((player, i) => {
      const physicsPlayer = this.gamePlayerToPhysicsPlayer(player, i);
      this.players.push(physicsPlayer);
      Composite.add(this.world, physicsPlayer);
    });

    playersToRemove.forEach((player) => {
      this.players.splice(this.players.indexOf(player), 1);
      Composite.remove(this.world, player);
    });

    this.players.forEach((player) => {
      const gamePlayer = gamePlayers.find(
        (p) => p.name === (player.id as unknown as string)
      );
      if (!gamePlayer) {
        console.warn(`Player ${player.id} not found in game`);
        return;
      }

      if (gamePlayer.team === "spectator") {
        Composite.remove(this.world, player);
        return;
      }

      const fillStyle = gameMap.playerColors[gamePlayer.team];
      if (player.render.fillStyle !== fillStyle) {
        player.render.fillStyle = fillStyle;
        // TODO: change position when team is changed?
      }
    });
  }

  private resetPositions(): void {
    const { gameMap } = this.game;

    Body.setPosition(this.ball, {
      x: gameMap.initialPos.ball.x,
      y: gameMap.initialPos.ball.y,
    });
    Body.setVelocity(this.ball, { x: 0, y: 0 });

    this.players.forEach((player, i) => {
      const gamePlayer = this.game.players.find(
        (p) => p.name === String(player.id)
      );
      if (!gamePlayer) return;
      if (gamePlayer.team === "spectator") return;
      const possiblePositions = gameMap.initialPos[gamePlayer.team];
      const position = possiblePositions[i] || possiblePositions[0];
      Body.setPosition(player, { x: position.x, y: position.y });
      Body.setVelocity(player, { x: 0, y: 0 });
    });
  }

  private applyForces(
    player: PhysicsPlayer,
    {
      rightClicked,
      leftClicked,
      upClicked,
      downClicked,
      spaceClicked,
    }: Keyboard
  ): boolean {
    let appliedForce = false;
    player.render.lineWidth = spaceClicked ? PLAYER_POWER_KICK_RADIUS * 2 : 0;

    if (!this.isHost()) {
      return appliedForce;
    }

    if (
      !player.__lastForceApplyTime ||
      now() - player.__lastForceApplyTime > MIN_FORCE_APPLY_INTERVAL
    ) {
      const velocityVector = { ...player.velocity };

      let change = MOVEMENT_VELOCITY_CHANGE;
      if ((leftClicked || rightClicked) && (upClicked || downClicked)) {
        change /= 2;
      }

      if (leftClicked) velocityVector.x -= MOVEMENT_VELOCITY_CHANGE;
      if (rightClicked) velocityVector.x += MOVEMENT_VELOCITY_CHANGE;
      if (upClicked) velocityVector.y -= MOVEMENT_VELOCITY_CHANGE;
      if (downClicked) velocityVector.y += MOVEMENT_VELOCITY_CHANGE;

      velocityVector.x = Math.min(
        Math.max(velocityVector.x, -PLAYER_MAX_VELOCITY),
        PLAYER_MAX_VELOCITY
      );
      velocityVector.y = Math.min(
        Math.max(velocityVector.y, -PLAYER_MAX_VELOCITY),
        PLAYER_MAX_VELOCITY
      );

      if (velocityVector.x !== 0 || velocityVector.y !== 0) {
        Body.setVelocity(player, velocityVector);
        player.__lastForceApplyTime = now();
        appliedForce = true;
      }
    }

    if (!spaceClicked) return appliedForce;

    const bodyPos = player.position;
    const ballPos = this.ball.position;
    const ballDistance = Math.sqrt(
      Math.pow(bodyPos.x - ballPos.x, 2) + Math.pow(bodyPos.y - ballPos.y, 2)
    );

    if (ballDistance < PLAYER_RADIUS + BALL_RADIUS + PLAYER_POWER_KICK_RADIUS) {
      const impactDirection = {
        x: (ballPos.x - bodyPos.x) / ballDistance,
        y: (ballPos.y - bodyPos.y) / ballDistance,
      };
      const playerVelocity = Body.getVelocity(player);

      Body.setVelocity(this.ball, {
        x: BALL_FORCE_MULTIPLIER * impactDirection.x + playerVelocity.x,
        y: BALL_FORCE_MULTIPLIER * impactDirection.y + playerVelocity.y,
      });
      appliedForce = true;
    }

    return appliedForce;
  }

  start(): void {
    this.syncPlayers();
    Render.run(this.render);
    Runner.run(this.runner, this.engine);
    this.applyForcesTimer = setInterval(() => this.applyAllForces(), 1000 / 30);
  }

  stop(): void {
    if (!this.applyForcesTimer) return;

    clearInterval(this.applyForcesTimer);
    this.applyForcesTimer = null;

    Render.stop(this.render);
    Runner.stop(this.runner);
  }

  isRunning(): boolean {
    return !!this.applyForcesTimer;
  }

  getSnapshot(): Snapshot {
    return {
      ball: {
        x: this.ball.position.x,
        y: this.ball.position.y,
        velocityX: this.ball.velocity.x,
        velocityY: this.ball.velocity.y,
      },
      players: this.players.reduce((acc, player) => {
        acc[player.id as unknown as string] = {
          x: player.position.x,
          y: player.position.y,
          velocityX: player.velocity.x,
          velocityY: player.velocity.y,
        };
        return acc;
      }, {} as Record<string, SnapshotCoordinates>),
    };
  }

  applySnapshot(snapshot: Snapshot): void {
    const { ball, players: snapshotPlayers } = snapshot;

    Body.setPosition(this.ball, { x: ball.x, y: ball.y });
    Body.setVelocity(this.ball, { x: ball.velocityX, y: ball.velocityY });

    for (let player of this.players) {
      if (!snapshotPlayers[player.id]) {
        console.warn(`Player ${player.id} not found in snapshot`);
        return;
      }

      const { x, y, velocityX, velocityY } = snapshotPlayers[player.id];

      Body.translate(player, {
        x: x - player.position.x,
        y: y - player.position.y,
      });
      Body.setVelocity(player, { x: velocityX, y: velocityY });
    }
  }
}
