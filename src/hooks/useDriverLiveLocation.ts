import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LatLng {
  lat: number;
  lng: number;
}

export const useDriverLiveLocation = (driverId: string | null | undefined) => {
  const [location, setLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!driverId) {
      setLocation(null);
      return;
    }

    let active = true;

    const fetchLocation = async () => {
      const { data } = await (supabase as any)
        .from("driver_profiles")
        .select("lat, lng")
        .eq("id", driverId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (typeof data?.lat === "number" && typeof data?.lng === "number") {
        setLocation({ lat: data.lat, lng: data.lng });
      } else {
        setLocation(null);
      }
    };

    void fetchLocation();

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_profiles", filter: `id=eq.${driverId}` },
        (payload) => {
          const nextRow = payload.new as { lat?: number | null; lng?: number | null };
          if (typeof nextRow?.lat === "number" && typeof nextRow?.lng === "number") {
            setLocation({ lat: nextRow.lat, lng: nextRow.lng });
            return;
          }

          setLocation(null);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return location;
};
