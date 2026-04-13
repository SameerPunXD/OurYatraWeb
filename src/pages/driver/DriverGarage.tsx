import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const DriverGarage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [garages, setGarages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [locationAccuracy, setLocationAccuracy] = useState<"exact" | "approximate">("exact");
  const [submitting, setSubmitting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const mapCenter: [number, number] = driverLat != null && driverLng != null ? [driverLat, driverLng] : [27.7172, 85.3240];

  const fetchData = async () => {
    const [gRes, sRes] = await Promise.all([
      (supabase as any).from("garages").select("*").eq("is_open", true).order("created_at", { ascending: false }),
      (supabase as any).from("garage_services").select("*").eq("is_available", true).order("created_at", { ascending: false }),
    ]);
    setGarages(gRes.data || []);
    setServices(sRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!selectedGarageId) return;
    if (driverLat != null && driverLng != null) return;
    useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGarageId]);

  const visibleServices = useMemo(() => services.filter((s) => s.garage_id === selectedGarageId), [services, selectedGarageId]);
  const totalAmount = useMemo(() => visibleServices.filter((s) => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.price || 0), 0), [visibleServices, selectedServiceIds]);
  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setShowCheckout(false);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!MAPBOX_TOKEN) return;
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
      const data = await res.json();
      const name = data?.features?.[0]?.place_name;
      if (name) setDriverAddress(name);
    } catch {}
  };

  const setPickedLocation = async (lat: number, lng: number, mode: "exact" | "approximate") => {
    setDriverLat(lat);
    setDriverLng(lng);
    setLocationAccuracy(mode);
    await reverseGeocode(lat, lng);
  };

  const geocodeApproximate = async () => {
    if (!MAPBOX_TOKEN || !driverAddress) return false;
    try {
      const q = encodeURIComponent(driverAddress);
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=np`);
      const data = await res.json();
      const center = data?.features?.[0]?.center;
      if (Array.isArray(center) && center.length === 2) {
        await setPickedLocation(center[1], center[0], "approximate");
        toast({ title: "Approximate location used" });
        return true;
      }
    } catch {}
    return false;
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      geocodeApproximate();
      return toast({ title: "GPS unavailable", description: "Using approximate location from address." });
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setPickedLocation(pos.coords.latitude, pos.coords.longitude, "exact");
        toast({ title: "Exact location captured" });
      },
      async () => {
        const ok = await geocodeApproximate();
        if (!ok) toast({ title: "Location failed", description: "Add address or pick on map.", variant: "destructive" });
      }
    );
  };

  const searchMapPlaces = async () => {
    if (!MAPBOX_TOKEN || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&limit=6&country=np`);
      const data = await res.json();
      setSearchResults(data?.features || []);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally { setSearching(false); }
  };

  const pickResult = async (feature: any) => {
    const [lng, lat] = feature.center || [];
    if (lat == null || lng == null) return;
    setDriverAddress(feature.place_name || feature.text || "Selected on map");
    await setPickedLocation(lat, lng, "approximate");
    toast({ title: "Location selected" });
  };

  const placeOrder = async () => {
    if (!user || !selectedGarageId || selectedServiceIds.length === 0) return toast({ title: "Missing info", description: "Select garage and services.", variant: "destructive" });
    if (!driverAddress) return toast({ title: "Location needed", description: "Please add your location/address.", variant: "destructive" });
    if (driverLat == null || driverLng == null) await geocodeApproximate();

    setSubmitting(true);
    try {
      const selectedItems = visibleServices.filter((s) => selectedServiceIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name, price: s.price }));
      const { error } = await (supabase as any).from("garage_orders").insert({
        garage_id: selectedGarageId,
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
      });
      if (error) throw error;
      toast({ title: "Order placed", description: "Garage can now see your location." });
      setSelectedServiceIds([]); setNotes("");
    } catch (error: any) {
      toast({ title: "Failed", description: error.message || "Could not place order", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Garage Services</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        {garages.map((g) => (
          <Card key={g.id} className={selectedGarageId === g.id ? "border-primary" : ""}>
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">{g.name}</p>
              <p className="text-sm text-muted-foreground">{g.address}</p>
              <p className="text-xs text-muted-foreground">{g.phone || "No phone"}</p>
              <Button size="sm" onClick={() => { setSelectedGarageId(g.id); setSelectedServiceIds([]); setShowCheckout(false); }}>Choose Garage</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedGarageId && (
        <Card>
          <CardHeader><CardTitle>Select services</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {visibleServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services listed for this garage.</p>
            ) : (
              <div className="grid gap-2">
                <AnimatePresence initial={false}>
                  {visibleServices.map((s, i) => {
                    const selected = selectedServiceIds.includes(s.id);
                    return (
                      <motion.label
                        key={s.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        whileTap={{ scale: 0.995 }}
                        className={`flex items-center justify-between border rounded-md p-3 cursor-pointer gap-3 transition-all ${selected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40 hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center gap-3">
                          {s.image_url && <img src={s.image_url} alt={s.name} className={`h-12 w-12 rounded object-cover border transition-transform ${selected ? "scale-105" : ""}`} />}
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.description || "—"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border"}`}
                        >
                          Rs {s.price} {selected ? "• Selected" : "• Add"}
                        </button>
                      </motion.label>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {!showCheckout ? (
                <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Step 2 complete: {selectedServiceIds.length} service(s) selected.
                  </p>
                  <Button
                    onClick={() => setShowCheckout(true)}
                    disabled={selectedServiceIds.length === 0}
                  >
                    Continue to Location & Notes
                  </Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Your current address / landmark" value={driverAddress} onChange={(e) => setDriverAddress(e.target.value)} />
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>Use My Current Location</Button>
                    <Button type="button" variant="outline" size="sm" onClick={searchMapPlaces} disabled={searching || !searchQuery.trim()}>{searching ? "Searching..." : "Search typed place"}</Button>
                  </div>
                  <Input placeholder="Type place and click 'Search typed place'" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

                  {MAPBOX_TOKEN ? (
                    <div className="rounded-md border overflow-hidden">
                      <MapContainer center={mapCenter} zoom={13} style={{ height: 280, width: "100%" }}>
                        <TileLayer
                          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
                          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
                        />
                        <LocationPicker onPick={(lat, lng) => setPickedLocation(lat, lng, "approximate")} />
                        {driverLat != null && driverLng != null && <CircleMarker center={[driverLat, driverLng]} radius={8} pathOptions={{ color: "#ef4444", fillOpacity: 0.8 }} />}
                      </MapContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">Mapbox token missing. Add VITE_MAPBOX_PUBLIC_TOKEN in .env</p>
                  )}

                  {searchResults.length > 0 && (
                    <div className="max-h-40 overflow-auto border rounded-md p-2 space-y-1">
                      {searchResults.map((r) => (
                        <button key={r.id} className="w-full text-left text-sm hover:bg-muted rounded px-2 py-1" onClick={() => pickResult(r)}>
                          {r.place_name}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {driverLat != null && driverLng != null
                      ? `Location mode: ${locationAccuracy === "exact" ? "Exact GPS" : "Approximate (map/address)"}. Tip: click anywhere on map to set pin.`
                      : "Location not pinned yet. Use GPS, click map, or search place."}
                  </p>

                  <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div className="flex gap-2">
                    <Button type="button" variant={paymentMethod === "cash" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("cash")}>Cash</Button>
                    <Button type="button" variant={paymentMethod === "online" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("online")}>Online</Button>
                  </div>
                  <p className="text-sm font-semibold">Total: Rs {totalAmount}</p>
                  <Button onClick={placeOrder} disabled={submitting || selectedServiceIds.length === 0}>{submitting ? "Placing..." : "Place Garage Order"}</Button>
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
