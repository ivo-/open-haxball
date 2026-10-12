import {
  COLLISION_FILTER_BALL,
  COLLISION_FILTER_OTHER,
  PLAYER_RADIUS,
} from "./config";
import { GameMap, Obstacle, ObstacleCircle, ObstacleRectangle } from "./types";

const width = 1000;
const height = 550;
const goalInset = 76;
const goalDepth = 34;
const goalHeight = 108;
const wallThickness = 2000;
const wallMultiplier = 20;

const margin = PLAYER_RADIUS * 2;
const innerWidth = width - margin * 2;
const innerHeight = height - margin * 2;

const goalTop = (height - goalHeight) / 2;
const goalBottom = goalTop + goalHeight;

const zone = (width - goalInset * 2) / 3;
const blueLeft = goalInset + zone;
const blueRight = goalInset + zone * 2;
const centerX = width / 2;
const centerY = height / 2;

const boards = "#0c2340";
const ice = "#e7f5fb";
const sheen = "rgba(255, 255, 255, 0.45)";
const kick = "#e8b84a";
const redLine = "#e23d4a";
const blueLine = "#2f6fe0";
const crease = "#b7def0";
const net = "#e6eef3";
const goalRed = "#d0122d";
const faceoff = "#d0122d";

const paint = COLLISION_FILTER_OTHER;

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke = fill,
  strokeWidth = 0,
  collisionMask?: number,
): ObstacleRectangle {
  return {
    x,
    y,
    width: w,
    height: h,
    fill,
    stroke,
    strokeWidth,
    ...(collisionMask !== undefined ? { collisionMask } : {}),
  };
}

function circle(
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke = fill,
  strokeWidth = 2,
  collisionMask?: number,
): ObstacleCircle {
  return {
    x,
    y,
    radius,
    fill,
    stroke,
    strokeWidth,
    ...(collisionMask !== undefined ? { collisionMask } : {}),
  };
}

function line(x: number, y: number, w: number, h: number, color: string): ObstacleRectangle {
  return rect(x, y, w, h, color, color, 0, paint);
}

function faceoffCircle(x: number, y: number): Obstacle[] {
  const radius = 46;
  const tick = 16;
  const gap = 10;

  return [
    circle(x, y, radius, "transparent", faceoff, 2, paint),
    circle(x, y, 3, faceoff, faceoff, 0, paint),
    line(x - radius - 2, y - gap - tick, 2, tick, faceoff),
    line(x - radius - 2, y + gap, 2, tick, faceoff),
    line(x + radius, y - gap - tick, 2, tick, faceoff),
    line(x + radius, y + gap, 2, tick, faceoff),
  ];
}

function goal(side: "red" | "blue"): Obstacle[] {
  const mouthX = side === "red" ? goalInset : width - goalInset;
  const backX = side === "red" ? mouthX - goalDepth : mouthX + goalDepth;
  const barX = side === "red" ? backX : mouthX;
  const lineX = mouthX - 1.5;

  return [
    rect(barX, goalTop, goalDepth, goalHeight, net, "transparent", 0, paint),
    rect(backX, goalTop, 1, goalHeight, goalRed, goalRed, 3),
    rect(barX, goalTop, goalDepth, 1, goalRed, goalRed, 3),
    rect(barX, goalBottom, goalDepth, 1, goalRed, goalRed, 3),
    line(lineX, margin, 3, goalTop - margin, redLine),
    line(lineX, goalBottom, 3, margin + innerHeight - goalBottom, redLine),
    circle(mouthX, goalTop, 8, goalRed, "#fff", 2),
    circle(mouthX, goalBottom, 8, goalRed, "#fff", 2),
  ];
}

function goalCrease(side: "red" | "blue"): ObstacleRectangle {
  const depth = 36;
  const flare = 14;
  const x = side === "red" ? goalInset : width - goalInset - depth;
  return rect(x, goalTop - flare, depth, goalHeight + flare * 2, crease, "transparent", 0, paint);
}

const leftDotX = (goalInset + blueLeft) / 2;
const rightDotX = (blueRight + (width - goalInset)) / 2;

const hockeyMap: GameMap = {
  width,
  height,
  background: boards,
  obstacles: [
    rect(margin, margin, innerWidth, innerHeight, ice, "transparent", 0, paint),
    rect(blueLeft, margin, blueRight - blueLeft, innerHeight, sheen, "transparent", 0, paint),

    line(margin, margin + 2, innerWidth, 5, kick),
    line(margin, margin + innerHeight - 7, innerWidth, 5, kick),
    line(margin + 2, margin, 5, innerHeight, kick),
    line(margin + innerWidth - 7, margin, 5, innerHeight, kick),

    line(blueLeft - 2, margin, 4, innerHeight, blueLine),
    line(blueRight - 2, margin, 4, innerHeight, blueLine),
    line(centerX - 2, margin, 4, innerHeight, redLine),

    goalCrease("red"),
    goalCrease("blue"),
    ...goal("red"),
    ...goal("blue"),
    ...faceoffCircle(leftDotX, centerY - 100),
    ...faceoffCircle(leftDotX, centerY + 100),
    ...faceoffCircle(rightDotX, centerY - 100),
    ...faceoffCircle(rightDotX, centerY + 100),

    circle(centerX, centerY, 58, "transparent", blueLine, 2, paint),
    circle(centerX, centerY, 4, redLine, redLine, 0, paint),
    circle(centerX - 150, centerY - 110, 3, redLine, redLine, 0, paint),
    circle(centerX + 150, centerY - 110, 3, redLine, redLine, 0, paint),
    circle(centerX - 150, centerY + 110, 3, redLine, redLine, 0, paint),
    circle(centerX + 150, centerY + 110, 3, redLine, redLine, 0, paint),

    rect(margin, margin, innerWidth, 2, boards, boards, 0, COLLISION_FILTER_BALL),
    rect(margin, innerHeight + margin, innerWidth, 2, boards, boards, 0, COLLISION_FILTER_BALL),
    rect(margin, margin, 2, innerHeight, boards, boards, 0, COLLISION_FILTER_BALL),
    rect(innerWidth + margin, margin, 2, innerHeight, boards, boards, 0, COLLISION_FILTER_BALL),

    rect(-width * (wallMultiplier / 2), -wallThickness + 2, width * wallMultiplier, wallThickness, "transparent", "transparent"),
    rect(-width * (wallMultiplier / 2), height - 2, width * wallMultiplier, wallThickness, "transparent", "transparent"),
    rect(-wallThickness + 2, -height * (wallMultiplier / 2), wallThickness, height * wallMultiplier, "transparent", "transparent"),
    rect(width - 2, -height * (wallMultiplier / 2), wallThickness, height * wallMultiplier, "transparent", "transparent"),
  ],
  initialPos: {
    red: [
      { x: 390, y: centerY - 48 },
      { x: 300, y: centerY + 72 },
    ],
    blue: [
      { x: width - 390, y: centerY - 48 },
      { x: width - 300, y: centerY + 72 },
    ],
    ball: {
      x: centerX,
      y: centerY,
    },
  },
  goalLineRed: {
    x: goalInset,
    y: goalTop,
    y2: goalBottom,
    color: redLine,
  },
  goalLineBlue: {
    x: width - goalInset,
    y: goalTop,
    y2: goalBottom,
    color: redLine,
  },
  ballColor: "#14181c",
  ballStroke: "#d5dee6",
  playerColors: {
    red: "#ff4b6b",
    blue: "#4d8dff",
  },
  goalDepth,
};

export default hockeyMap;
