import {
  COLLISION_FILTER_BALL,
  COLLISION_FILTER_OTHER,
  PLAYER_RADIUS,
} from "./config";
import { GameMap } from "./types";

const width = 1000;
const height = 550;
const offset = 80;
const wallThickness = 2000;
const wallMultiplier = 20;

const innerWidth = width - PLAYER_RADIUS * 4;
const innerHeight = height - PLAYER_RADIUS * 4;

export const DOOR_WIDTH = 39;

const markingColor = "#C3E7B9";
const doorColor = "#FFCCCC";

const classicMap: GameMap = {
  width,
  height,
  obstacles: [
    // Door 1
    {
      x: offset - DOOR_WIDTH,
      y: height * (1 / 3),
      width: 1,
      height: height / 3,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: offset - DOOR_WIDTH,
      y: height * (1 / 3),
      width: DOOR_WIDTH,
      height: 1,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: offset - DOOR_WIDTH,
      y: height * (2 / 3),
      width: 30,
      height: 1,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: offset,
      y: height * (1 / 3),
      radius: 10,
      fill: doorColor,
      stroke: "transparent",
    },
    {
      x: offset,
      y: height * (2 / 3),
      radius: 10,
      fill: doorColor,
      stroke: "transparent",
    },
    // Door 2
    {
      x: width - offset + DOOR_WIDTH,
      y: height * (1 / 3),
      width: 1,
      height: height / 3,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: width - offset,
      y: height * (1 / 3),
      width: DOOR_WIDTH,
      height: 1,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: width - offset,
      y: height * (2 / 3),
      width: DOOR_WIDTH,
      height: 1,
      fill: "transparent",
      stroke: doorColor,
      strokeWidth: 1,
    },
    {
      x: width - offset,
      y: height * (1 / 3),
      radius: 10,
      fill: doorColor,
      stroke: "transparent",
    },
    {
      x: width - offset,
      y: height * (2 / 3),
      radius: 10,
      fill: doorColor,
      stroke: "transparent",
    },
    // center circle
    {
      x: width / 2,
      y: height / 2,
      radius: 80,
      fill: "transparent",
      stroke: markingColor,
      collisionMask: COLLISION_FILTER_OTHER,
    },
    // center point
    {
      x: width / 2,
      y: height / 2,
      radius: 5,
      fill: markingColor,
      stroke: markingColor,
      collisionMask: COLLISION_FILTER_OTHER,
    },
    // center line
    {
      x: width / 2,
      y: PLAYER_RADIUS * 2,
      width: 1,
      height: innerHeight,
      fill: markingColor,
      stroke: markingColor,
      strokeWidth: 0,
      collisionMask: COLLISION_FILTER_OTHER,
    },
    // field markings
    {
      // => top
      x: -width * (wallMultiplier / 2),
      y: -wallThickness + 2,
      width: width * wallMultiplier,
      height: wallThickness,
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
    },
    {
      // => inner top
      x: PLAYER_RADIUS * 2,
      y: PLAYER_RADIUS * 2,
      width: innerWidth,
      height: 2,
      fill: markingColor,
      stroke: markingColor,
      strokeWidth: 0,
      collisionMask: COLLISION_FILTER_BALL,
    },
    {
      // inner bottom
      x: PLAYER_RADIUS * 2,
      y: innerHeight + PLAYER_RADIUS * 2,
      width: innerWidth,
      height: 2,
      fill: markingColor,
      stroke: markingColor,
      strokeWidth: 0,
      collisionMask: COLLISION_FILTER_BALL,
    },
    {
      // bottom
      x: -width * (wallMultiplier / 2),
      y: height - 2,
      width: width * wallMultiplier,
      height: wallThickness,
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
    },
    {
      // => left
      x: -wallThickness + 2,
      y: -height * (wallMultiplier / 2),
      width: wallThickness,
      height: height * wallMultiplier,
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
    },
    {
      // => inner left
      x: PLAYER_RADIUS * 2,
      y: PLAYER_RADIUS * 2,
      width: 2,
      height: innerHeight,
      fill: markingColor,
      stroke: markingColor,
      strokeWidth: 0,
      collisionMask: COLLISION_FILTER_BALL,
    },
    {
      // => inner right
      x: innerWidth + PLAYER_RADIUS * 2,
      y: PLAYER_RADIUS * 2,
      width: 2,
      height: innerHeight,
      fill: markingColor,
      stroke: markingColor,
      strokeWidth: 0,
      collisionMask: COLLISION_FILTER_BALL,
    },
    {
      // => right
      x: width - 2,
      y: -height * (wallMultiplier / 2),
      width: wallThickness,
      height: height * wallMultiplier,
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
    },
  ],
  initialPos: {
    red: [
      { x: 100, y: 200 },
      { x: 100, y: 300 },
    ],
    blue: [
      { x: 800, y: 200 },
      { x: 800, y: 300 },
    ],
    ball: {
      x: width / 2,
      y: height / 2,
    },
  },
  goalLineRed: {
    x: offset,
    y: height * (1 / 3),
    y2: height * (2 / 3),
    color: markingColor,
  },
  goalLineBlue: {
    x: width - offset,
    y: height * (1 / 3),
    y2: height * (2 / 3),
    color: markingColor,
  },
  ballColor: "green",
  playerColors: {
    red: "#ff3860",
    blue: "#3273dc",
  },
};

export default classicMap;
