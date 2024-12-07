export const BALL_RADIUS = 10;
export const PLAYER_RADIUS = 20;

export const COLLISION_FILTER_DEFAULT = 1;
export const COLLISION_FILTER_GOAL_LINE = 2;
export const COLLISION_FILTER_BALL = 4;
export const COLLISION_FILTER_PLAYER = 8;
export const COLLISION_FILTER_OTHER = 16;

// The minimum interval between applying movement forces to the player.
export const MIN_FORCE_APPLY_INTERVAL = 150;

// The change in velocity applied to the player when moving.
export const MOVEMENT_VELOCITY_CHANGE = 0.5;

// The maximum velocity the player can reach when moving.
export const PLAYER_MAX_VELOCITY = 3;

// The radius around the player within which they can kick the ball.
export const PLAYER_POWER_KICK_RADIUS = 10;

// The force multiplier applied to the ball when kicked by a player.
export const BALL_FORCE_MULTIPLIER = 5;

// The time step between updates in milliseconds.
export const PHYSICS_RUNNER_INTERVAL = 1000 / 60;

// The time step between world snapshots in milliseconds.
export const SYNC_WORLDS_INTERVAL = 1000 / 20;
