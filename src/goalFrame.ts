import { PLAYER_RADIUS } from "./config";

/** Solid thickness of each goal bar. Larger than one physics step. */
export const GOAL_FRAME = 12;

/**
 * Distance from the goal line to the inner face of the back wall.
 * Deep enough that a player disc fits in the pocket without being crushed.
 */
export const GOAL_DEPTH = PLAYER_RADIUS * 2 + GOAL_FRAME + 8;

/** How far the solid frame continues past the back wall, off the pitch. */
const PLUG = 240;

export type FrameWall = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Solid U around a goal. The inner edges sit on the painted frame. */
export function goalFrameWalls(
  side: "red" | "blue",
  mouthX: number,
  top: number,
  bottom: number,
  depth: number,
): FrameWall[] {
  const mouthHeight = bottom - top;
  const backX = side === "red" ? mouthX - depth : mouthX + depth;
  const lipX = side === "red" ? backX - PLUG : mouthX;
  const lipW = depth + PLUG;

  const back =
    side === "red"
      ? {
          x: backX + 1 - PLUG,
          y: top - GOAL_FRAME / 2,
          width: PLUG,
          height: mouthHeight + GOAL_FRAME,
        }
      : {
          x: backX,
          y: top - GOAL_FRAME / 2,
          width: PLUG,
          height: mouthHeight + GOAL_FRAME,
        };

  return [
    back,
    { x: lipX, y: top + 1 - GOAL_FRAME, width: lipW, height: GOAL_FRAME },
    { x: lipX, y: bottom, width: lipW, height: GOAL_FRAME },
  ];
}

function circleOverlapsRect(
  cx: number,
  cy: number,
  radius: number,
  wall: FrameWall,
): boolean {
  const nearestX = Math.max(wall.x, Math.min(cx, wall.x + wall.width));
  const nearestY = Math.max(wall.y, Math.min(cy, wall.y + wall.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** First time in [0, 1] that the segment enters the box, or null. */
function segmentHitsAabb(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  return t0;
}

/**
 * Move a disc that crossed a goal wall back to the side it started on.
 * Nearest-face separation is wrong once the center has passed the wall:
 * it finishes the tunnel. The pre-step origin picks the face instead.
 */
export function keepDiscOutsideWall(
  position: { x: number; y: number },
  origin: { x: number; y: number },
  radius: number,
  wall: FrameWall,
): { x: number; y: number } | null {
  const endOverlaps = circleOverlapsRect(position.x, position.y, radius, wall);
  const centerCrossed = segmentHitsAabb(
    origin.x,
    origin.y,
    position.x,
    position.y,
    wall.x,
    wall.y,
    wall.x + wall.width,
    wall.y + wall.height,
  );
  if (!endOverlaps && centerCrossed === null) return null;

  const hit = segmentHitsAabb(
    origin.x,
    origin.y,
    position.x,
    position.y,
    wall.x - radius,
    wall.y - radius,
    wall.x + wall.width + radius,
    wall.y + wall.height + radius,
  );

  if (hit !== null && hit > 0) {
    const t = Math.max(0, hit - 0.002);
    return {
      x: origin.x + (position.x - origin.x) * t,
      y: origin.y + (position.y - origin.y) * t,
    };
  }

  return pushTowardOrigin(position.x, position.y, radius, wall, origin);
}

function pushTowardOrigin(
  cx: number,
  cy: number,
  radius: number,
  wall: FrameWall,
  origin: { x: number; y: number },
): { x: number; y: number } | null {
  if (!circleOverlapsRect(cx, cy, radius, wall)) return null;

  const left = wall.x;
  const right = wall.x + wall.width;
  const top = wall.y;
  const bottom = wall.y + wall.height;
  const faces = [
    { limit: left - radius, outside: left - origin.x, horizontal: true, low: true },
    { limit: right + radius, outside: origin.x - right, horizontal: true, low: false },
    { limit: top - radius, outside: top - origin.y, horizontal: false, low: true },
    { limit: bottom + radius, outside: origin.y - bottom, horizontal: false, low: false },
  ];
  const clear = faces.filter((face) => face.outside > 0);
  const pool = clear.length > 0 ? clear : faces;
  const face = pool.reduce((best, candidate) =>
    clear.length > 0
      ? candidate.outside < best.outside
        ? candidate
        : best
      : candidate.outside > best.outside
        ? candidate
        : best,
  );

  if (face.horizontal) {
    if (face.low) {
      if (cx <= face.limit) return null;
      return { x: face.limit, y: cy };
    }
    if (cx >= face.limit) return null;
    return { x: face.limit, y: cy };
  }

  if (face.low) {
    if (cy <= face.limit) return null;
    return { x: cx, y: face.limit };
  }
  if (cy >= face.limit) return null;
  return { x: cx, y: face.limit };
}
