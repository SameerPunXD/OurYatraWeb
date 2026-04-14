import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getH3Cell } from "@/lib/h3";

interface LatLng {
  lat: number;
  lng: number;
}

const HEARTBEAT_MS = 5_000;
const MIN_MOVE_METERS = 25;
const PROFILE_POLL_MS = 5_000;

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (origin: LatLng, target: LatLng) => {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLng = toRadians(target.lng - origin.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(origin.lat))
    * Math.cos(toRadians(target.lat))
    * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useDriverPresence = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isDriverRoute = location.pathname.startsWith("/driver");
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const latestCoordsRef = useRef<LatLng | null>(null);
  const lastSentRef = useRef<{ coords: LatLng; sentAt: number } | null>(null);
  const isOnlineRef = useRef(false);

  useEffect(() => {
    const clearTracking = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const removePendingRides = async () => {
      if (!user) {
        return;
      }

      try {
        await (supabase as any).rpc("remove_driver_from_pending_rides");
      } catch (error) {
        console.debug("[Driver presence] failed to remove driver from pending rides", error);
      }
    };

    const sendPresence = async (force = false) => {
      if (!user || !isOnlineRef.current || !latestCoordsRef.current) {
        return;
      }

      const now = Date.now();
      const latestCoords = latestCoordsRef.current;
      const lastSent = lastSentRef.current;
      const movedMeters = lastSent ? distanceMeters(lastSent.coords, latestCoords) : Number.POSITIVE_INFINITY;

      if (!force && lastSent && movedMeters < MIN_MOVE_METERS && now - lastSent.sentAt < HEARTBEAT_MS) {
        return;
      }

      try {
        const h3Cell = getH3Cell(latestCoords.lat, latestCoords.lng, 9);

        await (supabase as any)
          .from("driver_profiles")
          .upsert({
            id: user.id,
            lat: latestCoords.lat,
            lng: latestCoords.lng,
            h3_r9: h3Cell,
            last_seen_at: new Date(now).toISOString(),
          }, { onConflict: "id" });

        if (import.meta.env.DEV) {
          console.debug("[Driver presence] stored live location", {
            h3Cell,
          });
        }

        lastSentRef.current = {
          coords: latestCoords,
          sentAt: now,
        };
      } catch (error) {
        console.debug("[Driver presence] failed to store driver presence", error);
      }
    };

    const startTracking = () => {
      if (!user || !isDriverRoute || !isOnlineRef.current || watchIdRef.current !== null || !navigator.geolocation) {
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          latestCoordsRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          void sendPresence();
        },
        (error) => {
          console.debug("[Driver presence] geolocation error", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: HEARTBEAT_MS,
          timeout: 15_000,
        },
      );

      heartbeatRef.current = window.setInterval(() => {
        void sendPresence(true);
      }, HEARTBEAT_MS);
    };

    const syncOnlineState = async () => {
      if (!user || !isDriverRoute) {
        const wasOnline = isOnlineRef.current;
        isOnlineRef.current = false;
        clearTracking();
        if (wasOnline) {
          void removePendingRides();
        }
        return;
      }

      const { data } = await (supabase as any)
        .from("driver_profiles")
        .select("is_online")
        .eq("id", user.id)
        .maybeSingle();

      const nextOnlineState = Boolean(data?.is_online);
      if (nextOnlineState !== isOnlineRef.current) {
        const wasOnline = isOnlineRef.current;
        isOnlineRef.current = nextOnlineState;
        if (!nextOnlineState) {
          clearTracking();
          if (wasOnline) {
            void removePendingRides();
          }
          return;
        }
      }

      if (nextOnlineState) {
        startTracking();
      }
    };

    const handleDriverProfileChanged = () => {
      void syncOnlineState();
      void sendPresence(true);
    };

    clearTracking();
    isOnlineRef.current = false;
    lastSentRef.current = null;
    latestCoordsRef.current = null;

    if (!user || !isDriverRoute) {
      return () => {
        clearTracking();
      };
    }

    void syncOnlineState();

    const pollId = window.setInterval(() => {
      void syncOnlineState();
    }, PROFILE_POLL_MS);

    window.addEventListener("driver-profile-changed", handleDriverProfileChanged);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("driver-profile-changed", handleDriverProfileChanged);
      clearTracking();
      if (isOnlineRef.current) {
        void removePendingRides();
      }
      isOnlineRef.current = false;
    };
  }, [isDriverRoute, user]);
};
