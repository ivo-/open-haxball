import {
  COLLISION_FILTER_BALL,
  COLLISION_FILTER_OTHER,
  PLAYER_RADIUS,
} from "./config";
import { GameMap, Obstacle, ObstacleCircle, ObstacleRectangle } from "./types";

const width = 1000;
const height = 550;
const goalInset = 80;
const wallThickness = 2000;
const wallMultiplier = 20;

const margin = PLAYER_RADIUS * 2;
const innerWidth = width - margin * 2;
const innerHeight = height - margin * 2;

const goalTop = height / 3;
const goalBottom = (height * 2) / 3;
const goalHeight = goalBottom - goalTop;

/** How far the ball must travel past the goal line before it scores. */
export const DOOR_WIDTH = 39;

const surround = "#10261c";
const pitch = "#2a7a46";
const stripe = "rgba(255, 255, 255, 0.07)";
const marking = "#d5efc6";
const red = "#ff4b6b";
const blue = "#4d8dff";
const redNet = "#d4526e";
const blueNet = "#3f78e6";

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

function pitchStripes(): ObstacleRectangle[] {
  const bands = 8;
  const bandWidth = innerWidth / bands;
  const stripes: ObstacleRectangle[] = [];

  // Mirrored so both goals sit on the same shade and the center circle is not split by a stripe.
  const lightBands = new Set([0, 2, 5, 7]);
  for (let i = 0; i < bands; i++) {
    if (!lightBands.has(i)) continue;
    stripes.push(
      rect(margin + i * bandWidth, margin, bandWidth, innerHeight, stripe, "transparent", 0, paint),
    );
  }

  return stripes;
}

function goalArea(side: "red" | "blue"): ObstacleRectangle[] {
  const mouthX = side === "red" ? goalInset : width - goalInset;
  const depth = 64;
  const flare = 32;
  const line = 2;
  const top = goalTop - flare;
  const boxHeight = goalHeight + flare * 2;
  const x = side === "red" ? mouthX : mouthX - depth;
  const goalLineX = side === "red" ? mouthX : mouthX - line;

  return [
    rect(x, top, depth, line, marking, marking, 0, paint),
    rect(x, top + boxHeight - line, depth, line, marking, marking, 0, paint),
    rect(
      side === "red" ? x + depth - line : x,
      top,
      line,
      boxHeight,
      marking,
      marking,
      0,
      paint,
    ),
    // Run the goal line out to the box so it meets the posts.
    rect(goalLineX, top, line, flare, marking, marking, 0, paint),
    rect(goalLineX, goalBottom, line, flare, marking, marking, 0, paint),
  ];
}

function goal(side: "red" | "blue"): Obstacle[] {
  const mouthX = side === "red" ? goalInset : width - goalInset;
  const backX = side === "red" ? mouthX - DOOR_WIDTH : mouthX + DOOR_WIDTH;
  const barX = side === "red" ? backX : mouthX;
  const color = side === "red" ? red : blue;
  const net = side === "red" ? redNet : blueNet;

  return [
    rect(barX, goalTop, DOOR_WIDTH, goalHeight, net, "transparent", 0, paint),
    rect(backX, goalTop, 1, goalHeight, color, color, 3),
    rect(barX, goalTop, DOOR_WIDTH, 1, color, color, 3),
    rect(barX, goalBottom, DOOR_WIDTH, 1, color, color, 3),
    circle(mouthX, goalTop, 10, color, "#fff", 2),
    circle(mouthX, goalBottom, 10, color, "#fff", 2),
  ];
}

const classicMap: GameMap = {
  width,
  height,
  background: surround,
  obstacles: [
    rect(margin, margin, innerWidth, innerHeight, pitch, "transparent", 0, paint),
    ...pitchStripes(),

    // Ball rails. The side rails sit at the back of each goal, so the mouth stays open.
    rect(margin, margin, innerWidth, 2, marking, marking, 0, COLLISION_FILTER_BALL),
    rect(margin, innerHeight + margin, innerWidth, 2, marking, marking, 0, COLLISION_FILTER_BALL),
    rect(margin, margin, 2, innerHeight, marking, marking, 0, COLLISION_FILTER_BALL),
    rect(innerWidth + margin, margin, 2, innerHeight, marking, marking, 0, COLLISION_FILTER_BALL),

    rect(width / 2 - 1.5, margin, 3, innerHeight, marking, marking, 0, paint),
    ...goalArea("red"),
    ...goalArea("blue"),
    ...goal("red"),
    ...goal("blue"),

    circle(width / 2, height / 2, 80, "transparent", marking, 2, paint),
    circle(width / 2, height / 2, 4, marking, marking, 0, paint),

    // Outer walls. Players are also clamped in physics, so these catch anything that slips through.
    rect(-width * (wallMultiplier / 2), -wallThickness + 2, width * wallMultiplier, wallThickness, "transparent", "transparent"),
    rect(-width * (wallMultiplier / 2), height - 2, width * wallMultiplier, wallThickness, "transparent", "transparent"),
    rect(-wallThickness + 2, -height * (wallMultiplier / 2), wallThickness, height * wallMultiplier, "transparent", "transparent"),
    rect(width - 2, -height * (wallMultiplier / 2), wallThickness, height * wallMultiplier, "transparent", "transparent"),
  ],
  initialPos: {
    red: [
      { x: 200, y: height / 2 - 80 },
      { x: 200, y: height / 2 + 80 },
    ],
    blue: [
      { x: width - 200, y: height / 2 - 80 },
      { x: width - 200, y: height / 2 + 80 },
    ],
    ball: {
      x: width / 2,
      y: height / 2,
    },
  },
  goalLineRed: {
    x: goalInset,
    y: goalTop,
    y2: goalBottom,
    color: marking,
  },
  goalLineBlue: {
    x: width - goalInset,
    y: goalTop,
    y2: goalBottom,
    color: marking,
  },
  ballColor: "#f4fff8",
  ballStroke: "#1a5c38",
  playerColors: {
    red,
    blue,
  },
};

export default classicMap;
