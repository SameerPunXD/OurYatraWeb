import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  autocompletePlaces,
  geocodeAddress,
  geocodePlaceId,
  hasGoogleMapsApiKey,
  loadGoogleMaps,
  reverseGeocodeLatLng,
  type GooglePlaceSuggestion,
} from "@/lib/googleMaps";

const defaultCenter = { lat: 27.7172, lng: 85.324 };

const DriverGarage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [garages, setGarages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [serviceLocationMode, setServiceLocationMode] = useState<"drop_off" | "pickup">("drop_off");
  const [locationAccuracy, setLocationAccuracy] = useState<"exact" | "approximate">("exact");
  const [submitting, setSubmitting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GooglePlaceSuggestion[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);

  const fetchData = async () => {
    const [gRes, sRes] = await Promise.all([
      (supabase as any).from("garages").select("*").eq("is_open", true).order("created_at", { ascending: false }),
      (supabase as any)
        .from("garage_services")
        .select("*")
        .eq("is_available", true)
        .in("vehicle_category", ["four_wheeler", "both"])
        .order("created_at", { ascending: false }),
    ]);
    setGarages(gRes.data || []);
    setServices(sRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedGarageId) return;
    if (driverLat != null && driverLng != null) return;
    useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGarageId]);

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (!hasGoogleMapsApiKey()) {
        setMapError("Google Maps API key missing. Add VITE_GOOGLE_MAPS_API_KEY in .env");
        return;
      }

      try {
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !mapContainerRef.current || mapRef.current) {
          return;
        }

        mapRef.current = new googleMaps.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        clickListenerRef.current = mapRef.current.addListener("click", (event) => {
          if (!event.latLng) {
            return;
          }

          void setPickedLocation(event.latLng.lat(), event.latLng.lng(), "approximate");
        });
      } catch (error) {
        setMapError((error as Error).message || "Could not load Google Maps.");
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      markerRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const googleApi = (window as any).google;
    if (!map || !googleApi?.maps) {
      return;
    }

    const hasPinnedLocation = driverLat != null && driverLng != null;

    if (!hasPinnedLocation) {
      markerRef.current?.setMap(null);
      return;
    }

    const position = { lat: driverLat, lng: driverLng };

    if (!markerRef.current) {
      markerRef.current = new googleApi.maps.Marker({
        map,
        position,
        title: "Driver location",
      });
    } else {
      markerRef.current.setMap(map);
      markerRef.current.setPosition(position);
    }

    map.setCenter(position);
    map.setZoom(locationAccuracy === "exact" ? 16 : 14);
  }, [driverLat, driverLng, locationAccuracy]);

  const visibleServices = useMemo(
    () => services.filter((service) => service.garage_id === selectedGarageId),
    [services, selectedGarageId],
  );

  const totalAmount = useMemo(
    () => visibleServices
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((sum, service) => sum + Number(service.price || 0), 0),
    [selectedServiceIds, visibleServices],
  );

  const toggleService = (id: string) => {
    setSelectedServiceIds((current) => (
      current.includes(id) ? current.filter((existingId) => existingId !== id) : [...current, id]
    ));
    setShowCheckout(false);
  };

  const setPickedLocation = async (lat: number, lng: number, mode: "exact" | "approximate") => {
    setDriverLat(lat);
    setDriverLng(lng);
    setLocationAccuracy(mode);
    setDriverAddress(await reverseGeocodeLatLng(lat, lng));
  };

  const geocodeApproximate = async () => {
    const result = await geocodeAddress(driverAddress);
    if (!result) {
      return false;
    }

    setDriverAddress(result.name);
    await setPickedLocation(result.latlng.lat, result.latlng.lng, "approximate");
    toast({ title: "Approximate location used" });
    return true;
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      void geocodeApproximate();
      toast({ title: "GPS unavailable", description: "Using approximate location from address." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await setPickedLocation(position.coords.latitude, position.coords.longitude, "exact");
        toast({ title: "Exact location captured" });
      },
      async () => {
        const ok = await geocodeApproximate();
        if (!ok) {
          toast({ title: "Location failed", description: "Add address or pick on map.", variant: "destructive" });
        }
      },
    );
  };

  const searchMapPlaces = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const results = await autocompletePlaces(
        searchQuery.trim(),
        driverLat != null && driverLng != null ? { lat: driverLat, lng: driverLng } : null,
      );
      setSearchResults(results);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const pickResult = async (suggestion: GooglePlaceSuggestion) => {
    const place = await geocodePlaceId(suggestion.placeId);
    if (!place) {
      toast({ title: "Location failed", description: "Could not resolve the selected place.", variant: "destructive" });
      return;
    }

    setDriverAddress(place.name);
    await setPickedLocation(place.latlng.lat, place.latlng.lng, "approximate");
    setSearchResults([]);
    toast({ title: "Location selected" });
  };

  const placeOrder = async () => {
    if (!user || !selectedGarageId || selectedServiceIds.length === 0) {
      toast({ title: "Missing info", description: "Select garage and services.", variant: "destructive" });
      return;
    }

    if (!driverAddress) {
      toast({ title: "Location needed", description: "Please add your location/address.", variant: "destructive" });
      return;
    }

    if (driverLat == null || driverLng == null) {
      await geocodeApproximate();
    }

    setSubmitting(true);

    try {
      const selectedItems = visibleServices
        .filter((service) => selectedServiceIds.includes(service.id))
        .map((service) => ({ id: service.id, name: service.name, price: service.price }));

      const { error } = await (supabase as any).from("garage_orders").insert({
        garage_id: selectedGarageId,
        requester_id: user.id,
        requester_role: "driver",
        requester_address: driverAddress,
        requester_lat: driverLat,
        requester_lng: driverLng,
        driver_id: user.id,
        items: selectedItems,
        notes: notes || null,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        status: "pending",
        driver_address: driverAddress,
        driver_lat: driverLat,
        driver_lng: driverLng,
        location_accuracy: locationAccuracy,
        vehicle_info: vehicleInfo || null,
        service_location_mode: serviceLocationMode,
      });

      if (error) throw error;

      toast({ title: "Order placed", description: "Garage can now see your location." });
      setSelectedServiceIds([]);
      setNotes("");
      setVehicleInfo("");
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      toast({ title: "Failed", description: error.message || "Could not place order", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Garage Services</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {garages.map((garage) => (
          <Card key={garage.id} className={selectedGarageId === garage.id ? "border-primary" : ""}>
            <CardContent className="space-y-2 p-4">
              <p className="font-semibold">{garage.name}</p>
              <p className="text-sm text-muted-foreground">{garage.address}</p>
              <p className="text-xs text-muted-foreground">{garage.phone || "No phone"}</p>
              <Button size="sm" onClick={() => { setSelectedGarageId(garage.id); setSelectedServiceIds([]); setShowCheckout(false); }}>
                Choose Garage
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedGarageId && (
        <Card>
          <CardHeader>
            <CardTitle>Select services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services listed for this garage.</p>
            ) : (
              <div className="grid gap-2">
                <AnimatePresence initial={false}>
                  {visibleServices.map((service, index) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <motion.label
                        key={service.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        whileTap={{ scale: 0.995 }}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 transition-all ${selected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40 hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center gap-3">
                          {service.image_url && <img src={service.image_url} alt={service.name} className={`h-12 w-12 rounded border object-cover transition-transform ${selected ? "scale-105" : ""}`} />}
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description || "—"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleService(service.id)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
                        >
                          Rs {service.price} {selected ? "• Selected" : "• Add"}
                        </button>
                      </motion.label>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {!showCheckout ? (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    Step 2 complete: {selectedServiceIds.length} service(s) selected.
                  </p>
                  <Button onClick={() => setShowCheckout(true)} disabled={selectedServiceIds.length === 0}>
                    Continue to Location & Notes
                  </Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Your current address / landmark" value={driverAddress} onChange={(event) => setDriverAddress(event.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                      Use My Current Location
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={searchMapPlaces} disabled={searching || !searchQuery.trim()}>
                      {searching ? "Searching..." : "Search typed place"}
                    </Button>
                  </div>
                  <Input placeholder="Type place and click 'Search typed place'" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />

                  {mapError ? (
                    <p className="text-xs text-destructive">{mapError}</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <div ref={mapContainerRef} className="h-[280px] w-full" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
                      {searchResults.map((result) => (
                        <button key={result.placeId} className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => pickResult(result)}>
                          {result.description}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {driverLat != null && driverLng != null
                      ? `Location mode: ${locationAccuracy === "exact" ? "Exact GPS" : "Approximate (map/address)"}. Click on the map to update your pin.`
                      : "Location not pinned yet. Use GPS, click the map, or search for a place."}
                  </p>

                  <Input placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  <Input placeholder="Vehicle details (model / plate)" value={vehicleInfo} onChange={(event) => setVehicleInfo(event.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={serviceLocationMode === "drop_off" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setServiceLocationMode("drop_off")}
                    >
                      Drop at Garage
                    </Button>
                    <Button
                      type="button"
                      variant={serviceLocationMode === "pickup" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setServiceLocationMode("pickup")}
                    >
                      Pickup from my location
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant={paymentMethod === "cash" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("cash")}>
                      Cash
                    </Button>
                    <Button type="button" variant={paymentMethod === "online" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("online")}>
                      Online
                    </Button>
                  </div>
                  <p className="text-sm font-semibold">Total: Rs {totalAmount}</p>
                  <Button onClick={placeOrder} disabled={submitting || selectedServiceIds.length === 0}>
                    {submitting ? "Placing..." : "Place Garage Order"}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DriverGarage;
