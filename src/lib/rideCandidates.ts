import { supabase } from "@/integrations/supabase/client";

const normalizeDriverIds = (driverIds: string[]) => (
  Array.from(new Set(driverIds.filter(Boolean))).sort()
);

export interface RideDriverCandidate {
  driver_id: string;
  expires_at: string | null;
  matched_at: string;
  ride_id: string;
  status: string;
}

export const getRideDriverCandidates = async (rideId: string) => {
  const { data, error } = await supabase
    .from("ride_driver_candidates")
    .select("ride_id, driver_id, status, matched_at, expires_at")
    .eq("ride_id", rideId)
    .order("matched_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as RideDriverCandidate[];
};

export const dispatchRideDriverCandidates = async (
  rideId: string,
  driverIds: string[],
  offerWindowSeconds = 5,
) => {
  const { data, error } = await (supabase as any).rpc("dispatch_ride_driver_candidates", {
    p_ride_id: rideId,
    p_driver_ids: normalizeDriverIds(driverIds),
    p_offer_window_seconds: offerWindowSeconds,
  });

  if (error) {
    throw error;
  }

  return data;
};

export const replaceRideDriverCandidates = async (rideId: string, driverIds: string[]) => {
  const { data, error } = await (supabase as any).rpc("replace_ride_driver_candidates", {
    p_ride_id: rideId,
    p_driver_ids: normalizeDriverIds(driverIds),
  });

  if (error) {
    throw error;
  }

  return data;
};
