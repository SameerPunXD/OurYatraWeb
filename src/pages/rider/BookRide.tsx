import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Home, Briefcase, MapPin, ArrowLeft } from "lucide-react";
import RideMap from "@/components/ride/RideMap";
import LocationSearch from "@/components/ride/LocationSearch";
import FareEstimate from "@/components/ride/FareEstimate";
import ActiveRideTracker from "@/components/ride/ActiveRideTracker";
import RatingDialog from "@/components/RatingDialog";
import SubscriptionGate from "@/components/SubscriptionGate";
import { reverseGeocodeLatLng } from "@/lib/googleMaps";

interface LatLng { lat: number; lng: number; }

type BookingState = "selecting" | "confirming" | "searching" | "active" | "completed";

const metersToLat = (meters: number) => meters / 111320;

const metersToLng = (meters: number, latitude: number) => {
  const latitudeCos = Math.cos((latitude * Math.PI) / 180);
  const safeCos = Math.abs(latitudeCos) < 0.0001 ? 0.0001 : latitudeCos;
  return meters / (111320 * safeCos);
};

const phantomVehicleOffsets = [
  { id: "car-1", type: "car" as const, north: 180, east: -140 },
  { id: "car-2", type: "car" as const, north: -260, east: 190 },
  { id: "car-3", type: "car" as const, north: 320, east: 220 },
  { id: "car-4", type: "car" as const, north: -120, east: -260 },
  { id: "bike-1", type: "bike" as const, north: 90, east: 70 },
  { id: "bike-2", type: "bike" as const, north: -110, east: 120 },
  { id: "bike-3", type: "bike" as const, north: 140, east: -40 },
  { id: "bike-4", type: "bike" as const, north: -180, east: -90 },
  { id: "bike-5", type: "bike" as const, north: 230, east: -210 },
  { id: "bike-6", type: "bike" as const, north: -300, east: 60 },
];

const BookRide = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<BookingState>("selecting");
  const [selectingFor, setSelectingFor] = useState<"pickup" | "dropoff" | null>(null);

  const [pickupName, setPickupName] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState<LatLng | null>(null);
  const [dropoffLatLng, setDropoffLatLng] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userLocationRadiusMeters, setUserLocationRadiusMeters] = useState<number | null>(null);

  const [booking, setBooking] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  // Auto-detect location (GPS first, then IP fallback)
  useEffect(() => {
    let cancelled = false;

    const setInitialPickup = async (loc: LatLng, radiusMeters: number) => {
      if (cancelled) {
        return;
      }

      setUserLocation(loc);
      setUserLocationRadiusMeters(radiusMeters);
      if (!pickupLatLng) {
        setPickupLatLng(loc);
        setPickupName(await reverseGeocodeLatLng(loc.lat, loc.lng));
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await setInitialPickup(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            pos.coords.accuracy || 220,
          );
        },
        () => {
          if (cancelled) {
            return;
          }

          toast({
            title: "Exact location unavailable",
            description: "Enable device location or set the pickup manually on the map.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      toast({
        title: "Location not supported",
        description: "Your browser cannot provide GPS location. Set the pickup manually on the map.",
        variant: "destructive",
      });
    }

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch saved addresses
  useEffect(() => {
    if (!user) return;
    supabase.from("saved_addresses").select("*").eq("user_id", user.id).then(({ data }) => setSavedAddresses(data || []));
  }, [user]);

  // Check for active ride on load
  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*").eq("rider_id", user.id)
      .in("status", ["pending", "accepted", "in_progress"])
      .order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setActiveRide(data[0]);
          setState(data[0].status === "pending" ? "searching" : "active");
        }
      });
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("ride-booking")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as any;
          if (["pending", "accepted", "in_progress"].includes(updated.status)) {
            setActiveRide(updated);
            if (updated.status === "accepted") {
              setState("active");
              toast({ title: "Driver found!", description: "Your driver is on the way." });
            }
            if (updated.status === "in_progress") {
              toast({ title: "Trip started!", description: "Enjoy your ride." });
            }
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleMapClick = useCallback(async (latlng: LatLng) => {
    if (selectingFor === "pickup") {
      setPickupLatLng(latlng);
      setPickupName(await reverseGeocodeLatLng(latlng.lat, latlng.lng));
      setSelectingFor(null);
    } else if (selectingFor === "dropoff") {
      setDropoffLatLng(latlng);
      setDropoffName(await reverseGeocodeLatLng(latlng.lat, latlng.lng));
      setSelectingFor(null);
    }
  }, [selectingFor]);

  const handleBook = async (vehicleType: string, fare: number, scheduledAt: string | null, notes: string) => {
    if (!user || !pickupLatLng || !dropoffLatLng) return;
    setBooking(true);

    const distance = haversineDistance(pickupLatLng, dropoffLatLng);

    const { data, error } = await supabase.from("rides").insert({
      rider_id: user.id,
      pickup_location: pickupName,
      dropoff_location: dropoffName,
      pickup_lat: pickupLatLng.lat,
      pickup_lng: pickupLatLng.lng,
      dropoff_lat: dropoffLatLng.lat,
      dropoff_lng: dropoffLatLng.lng,
      vehicle_type: vehicleType,
      fare,
      distance_km: Math.round(distance * 10) / 10,
      notes: notes || null,
      scheduled_at: scheduledAt,
    } as any).select().single();

    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      setActiveRide(data);
      setState("searching");
      toast({ title: scheduledAt ? "Ride scheduled!" : "Ride booked!", description: "Looking for a driver..." });
    }
    setBooking(false);
  };

  const handleSavedAddress = (addr: any, target: "pickup" | "dropoff") => {
    if (target === "pickup") {
      setPickupName(addr.address);
      if (addr.lat && addr.lng) setPickupLatLng({ lat: addr.lat, lng: addr.lng });
    } else {
      setDropoffName(addr.address);
      if (addr.lat && addr.lng) setDropoffLatLng({ lat: addr.lat, lng: addr.lng });
    }
  };

  const resetBooking = () => {
    setState("selecting");
    setActiveRide(null);
    setPickupName("");
    setDropoffName("");
    setPickupLatLng(userLocation);
    setDropoffLatLng(null);
    if (userLocation) setPickupName("Current Location");
  };

  const hasLocations = pickupLatLng && dropoffLatLng;
  const phantomAnchor = userLocation || pickupLatLng;
  const phantomVehicles = useMemo(() => {
    if (!phantomAnchor || state !== "selecting") {
      return [];
    }

    return phantomVehicleOffsets.map((offset) => ({
      id: offset.id,
      type: offset.type,
      position: {
        lat: phantomAnchor.lat + metersToLat(offset.north),
        lng: phantomAnchor.lng + metersToLng(offset.east, phantomAnchor.lat),
      },
    }));
  }, [phantomAnchor, state]);

  return (
    <SubscriptionGate fallbackMessage="Subscribe to book rides on OurYatra.">
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 -m-3 sm:-m-4 lg:-m-6 h-auto lg:h-[calc(100vh-4rem)]">
      {/* Map */}
      <div className="flex-1 lg:flex-[3] min-h-[40vh] lg:min-h-0">
        <RideMap
          pickup={pickupLatLng}
          dropoff={dropoffLatLng}
          driverLocation={null}
          onMapClick={handleMapClick}
          selectingFor={selectingFor}
          userLocation={userLocation}
          userLocationRadiusMeters={userLocationRadiusMeters}
          phantomVehicles={phantomVehicles}
        />
      </div>

      {/* Panel */}
      <div className="flex-1 lg:flex-[2] overflow-y-auto p-4 lg:p-6 space-y-4">
        {(state === "selecting" || state === "confirming") && (
          <>
            <h2 className="text-xl font-bold text-foreground">Book a Ride</h2>

            {/* Saved addresses quick pick */}
            {savedAddresses.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {savedAddresses.map(a => {
                  const Icon = a.label === "Home" ? Home : a.label === "Work" ? Briefcase : MapPin;
                  return (
                    <Button key={a.id} variant="outline" size="sm" className="gap-1.5" onClick={() => handleSavedAddress(a, dropoffLatLng ? "pickup" : "dropoff")}>
                      <Icon className="h-3.5 w-3.5" /> {a.label}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Location inputs */}
            <div className="space-y-3">
              <LocationSearch
                label="Pickup"
                placeholder="Where to pick you up?"
                value={pickupName}
                onSelect={(name, latlng) => { setPickupName(name); setPickupLatLng(latlng); }}
                onClear={() => { setPickupName(""); setPickupLatLng(null); }}
                onFocusSelect={() => setSelectingFor("pickup")}
                iconColor="text-green-600"
                proximity={userLocation}
              />
              <LocationSearch
                label="Destination"
                placeholder="Where are you going?"
                value={dropoffName}
                onSelect={(name, latlng) => { setDropoffName(name); setDropoffLatLng(latlng); }}
                onClear={() => { setDropoffName(""); setDropoffLatLng(null); }}
                onFocusSelect={() => setSelectingFor("dropoff")}
                iconColor="text-destructive"
                proximity={userLocation}
              />
            </div>

            {/* Map selection buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectingFor("pickup")} className={selectingFor === "pickup" ? "border-green-500 bg-green-50 text-green-700" : ""}>
                📍 Set Pickup on Map
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectingFor("dropoff")} className={selectingFor === "dropoff" ? "border-red-500 bg-red-50 text-red-700" : ""}>
                🏁 Set Destination on Map
              </Button>
            </div>

            {/* Fare estimate & book */}
            {hasLocations && (
              <FareEstimate
                pickup={pickupLatLng!}
                dropoff={dropoffLatLng!}
                onBook={handleBook}
                booking={booking}
              />
            )}

            {!hasLocations && (
              <Card>
                <CardContent className="p-8 text-center">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Select pickup and destination to see fare estimate</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {(state === "searching" || state === "active") && activeRide && (
          <>
            <ActiveRideTracker
              ride={activeRide}
              onCancelled={resetBooking}
              onCompleted={() => setState("completed")}
            />
          </>
        )}

        {state === "completed" && activeRide && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-4xl mb-3">🎉</p>
                <h3 className="text-lg font-bold text-foreground">Trip Completed!</h3>
                <p className="text-muted-foreground mt-1">You paid Rs {activeRide.fare}</p>
              </CardContent>
            </Card>
            <RatingDialog
              open={true}
              onOpenChange={(o) => { if (!o) resetBooking(); }}
              orderId={activeRide.id}
              orderType="ride"
              toUserId={activeRide.driver_id}
              title="Rate your driver"
            />
            <Button variant="outline" className="w-full" onClick={resetBooking}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Book Another Ride
            </Button>
          </div>
        )}
      </div>
    </div>
    </SubscriptionGate>
  );
};

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default BookRide;
