import { Keyboard } from "./keyboard";

export type Pos = {
  x: number;
  y: number;
};

export type Spectator = {
  // Used to create and join games
  id: string;
  name: string;
};

export type Player = Spectator & {
  team: "red" | "blue" | "spectator";
  keyboard: Keyboard;
};

export type ObstacleCircle = Pos & {
  fill: string;
  stroke: string;
  radius: number;
  collisionMask?: number;
};

export type ObstacleRectangle = Pos & {
  fill: string;
  stroke: string;
  strokeWidth: number;
  width: number;
  height: number;
  collisionMask?: number;
};

export type Obstacle = ObstacleCircle | ObstacleRectangle;

export type GameMap = {
  width: number;
  height: number;
  obstacles: Obstacle[];
  ballColor: string;
  playerColors: {
    red: string;
    blue: string;
  };
  initialPos: {
    red: Pos[];
    blue: Pos[];
    ball: Pos;
  };
  goalLineRed: Pos & { y2: number; color: string };
  goalLineBlue: Pos & { y2: number; color: string };
};

export type Game = {
  players: Player[];
  gameMap: GameMap;
  // TODO:
  // sound: boolean;
  scoreLimit: number;
  score: {
    red: number;
    blue: number;
  };
};

export type SnapshotCoordinates = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
};

export type Snapshot = {
  atFrame: number;
  ball: SnapshotCoordinates;
  players: Record<string, SnapshotCoordinates>;
};

export type GoalHandler = (team: "red" | "blue") => void;

export type ActionStartGame = {
  type: "startGame";
};

export type ActionStopGame = {
  type: "stopGame";
};

export type ActionIdentify = {
  type: "identify";
  name: string;
};

export type ActionUpdateGame = {
  type: "updateGame";
  game: Partial<Game>;
};

export type ActionUpdateKeyboard = {
  type: "updateKeyboard";
  keyboard: Keyboard;
};

export type ActionPushPlayer = {
  type: "addPlayer";
  playerID: string;
  playerName: string;
};

export type ActionRemovePlayer = {
  type: "removePlayer";
  playerID: string;
};

export type ActionGameSnapshot = {
  type: "gameSnapshot";
  snapshot: unknown;
};

export type ActionConnectTo = {
  type: "connectTo";
  playerIDs: string[];
};

export type Action =
  | ActionStartGame
  | ActionStopGame
  | ActionIdentify
  | ActionUpdateGame
  | ActionUpdateKeyboard
  | ActionPushPlayer
  | ActionRemovePlayer
  | ActionGameSnapshot
  | ActionConnectTo;
