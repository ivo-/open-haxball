import classicMap from "./gameMapClassic";
import hockeyMap from "./gameMapHockey";
import { GameMap } from "./types";

export type MapChoice = {
  id: string;
  name: string;
  blurb: string;
  map: GameMap;
};

export const MAPS: MapChoice[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "Football pitch",
    map: classicMap,
  },
  {
    id: "hockey",
    name: "Hockey",
    blurb: "Ice rink",
    map: hockeyMap,
  },
];

export function isMapId(id: string): boolean {
  return MAPS.some((choice) => choice.id === id);
}

export function getMap(id: string): GameMap {
  return MAPS.find((choice) => choice.id === id)?.map ?? classicMap;
}
