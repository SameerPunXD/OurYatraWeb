import { supabase } from "@/integrations/supabase/client";
import { getH3Cell, getNearbyCells } from "@/lib/h3";

interface DriverMatchRow {
  h3_r9: string | null;
  id: string;
  last_seen_at: string | null;
  lat: number | null;
  lng: number | null;
  service_mode: string | null;
  vehicle_type: string | null;
}

export interface NearbyDriver {
  distanceKm: number;
  h3_r9: string | null;
  id: string;
  last_seen_at: string | null;
  lat: number;
  lng: number;
  service_mode: string | null;
  vehicle_type: string | null;
}

export interface NearbyDriverResult {
  drivers: NearbyDriver[];
  nearbyCells: string[];
  riderCell: string;
  usedK: number;
}

interface MatchingOptions {
  excludeDriverIds?: string[];
  serviceMode?: string;
  vehicleType?: string | null;
}

const DRIVER_STALE_AFTER_MS = 10_000;
const MAX_DRIVER_RESULTS = 10;
const RPC_CANDIDATE_LIMIT = 50;

const rideVehicleTypeMap: Record<string, string[]> = {
  auto: ["auto"],
  bike: ["bike", "scooter"],
  taxi: ["car", "van"],
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number },
) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLng = toRadians(target.lng - origin.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(origin.lat))
    * Math.cos(toRadians(target.lat))
    * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeVehicleType = (value: string | null | undefined) => (
  value ? value.trim().toLowerCase() : ""
);

const filterExcludedDrivers = (
  drivers: DriverMatchRow[],
  excludeDriverIds: string[] = [],
) => {
  const blockedDriverIds = new Set(excludeDriverIds.filter(Boolean));
  if (blockedDriverIds.size === 0) {
    return drivers;
  }

  return drivers.filter((driver) => !blockedDriverIds.has(driver.id));
};

const filterByVehicleType = (drivers: DriverMatchRow[], vehicleType?: string | null) => {
  if (!vehicleType) {
    return drivers;
  }

  const allowedVehicleTypes = rideVehicleTypeMap[normalizeVehicleType(vehicleType)];
  if (!allowedVehicleTypes || allowedVehicleTypes.length === 0) {
    return drivers;
  }

  return drivers.filter((driver) => allowedVehicleTypes.includes(normalizeVehicleType(driver.vehicle_type)));
};

export const getNearbyDrivers = async (
  lat: number,
  lng: number,
  k = 2,
  options: MatchingOptions = {},
): Promise<NearbyDriverResult> => {
  const riderCell = getH3Cell(lat, lng, 9);
  const lastSeenAfter = new Date(Date.now() - DRIVER_STALE_AFTER_MS).toISOString();
  const maxK = Math.max(1, k);
  let nearbyCells = getNearbyCells(lat, lng, 1, 9);
  let rows: DriverMatchRow[] = [];
  let usedK = 1;

  console.debug("[H3 matching] rider cell", riderCell);
  console.debug("[H3 matching] max ring", maxK);

  for (let currentK = 1; currentK <= maxK; currentK += 1) {
    nearbyCells = getNearbyCells(lat, lng, currentK, 9);
    usedK = currentK;

    const { data, error } = await (supabase as any).rpc("match_nearby_drivers", {
      p_h3_cells: nearbyCells,
      p_last_seen_after: lastSeenAfter,
      p_limit: RPC_CANDIDATE_LIMIT,
      p_service_mode: options.serviceMode ?? "ride",
    });

    if (error) {
      throw error;
    }

    rows = filterExcludedDrivers(
      filterByVehicleType((data || []) as DriverMatchRow[], options.vehicleType),
      options.excludeDriverIds,
    )
      .filter((driver) => typeof driver.lat === "number" && typeof driver.lng === "number");

    console.debug("[H3 matching] nearby cells", nearbyCells.length);
    console.debug("[H3 matching] ring candidates", rows.length);

    if (rows.length > 0 || currentK === maxK) {
      break;
    }
  }

  const rankedDrivers = rows
    .map((driver) => ({
      ...driver,
      distanceKm: haversineDistanceKm({ lat, lng }, { lat: driver.lat as number, lng: driver.lng as number }),
      lat: driver.lat as number,
      lng: driver.lng as number,
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, MAX_DRIVER_RESULTS);

  console.debug("[H3 matching] ring used", usedK);
  console.debug("[H3 matching] drivers returned", rankedDrivers.length);

  return {
    riderCell,
    nearbyCells,
    drivers: rankedDrivers,
    usedK,
  };
};
