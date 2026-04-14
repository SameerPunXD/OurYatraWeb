import { gridDisk, latLngToCell } from "h3-js";

const DEFAULT_H3_RESOLUTION = 9;

const assertCoordinate = (value: number, label: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
};

export const getH3Cell = (lat: number, lng: number, resolution = DEFAULT_H3_RESOLUTION) => {
  assertCoordinate(lat, "Latitude");
  assertCoordinate(lng, "Longitude");
  return latLngToCell(lat, lng, resolution);
};

export const getNearbyCells = (lat: number, lng: number, k = 1, resolution = DEFAULT_H3_RESOLUTION) => {
  const centerCell = getH3Cell(lat, lng, resolution);
  return gridDisk(centerCell, k);
};
