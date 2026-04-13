import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import LocationSearch from "@/components/ride/LocationSearch";
import RideMap from "@/components/ride/RideMap";
import { FileText, Package, Truck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import SubscriptionGate from "@/components/SubscriptionGate";

interface LatLng { lat: number; lng: number; }

const PACKAGE_TYPES = [
  { value: "document", label: "Document", icon: FileText, base: 80, perKm: 12, desc: "Letters, files, papers" },
  { value: "small_parcel", label: "Small Parcel", icon: Package, base: 120, perKm: 18, desc: "Up to 5 kg" },
  { value: "large_parcel", label: "Large Parcel", icon: Truck, base: 200, perKm: 25, desc: "5–25 kg" },
];

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const SendParcel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pickupName, setPickupName] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [selectingFor, setSelectingFor] = useState<"pickup" | "dropoff" | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [packageType, setPackageType] = useState("small_parcel");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    const locationIqKey = import.meta.env.VITE_LOCATIONIQ_API_KEY;
    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    const pinnedFallback = `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

    try {
      if (locationIqKey) {
        const liqRes = await fetch(`https://us1.locationiq.com/v1/reverse?key=${locationIqKey}&lat=${lat}&lon=${lng}&format=json`);
        if (liqRes.ok) {
          const liq = await liqRes.json();
          const full = liq?.display_name;
          if (full) return full;
        }
      }

      if (mapboxToken) {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=en&types=address,poi,place,locality,neighborhood`);
        if (!res.ok) return pinnedFallback;
        const data = await res.json();
        const primary = data?.features?.[0];
        if (!primary) return pinnedFallback;
        return primary.place_name || pinnedFallback;
      }

      return pinnedFallback;
    } catch {
      return pinnedFallback;
    }
  };

  useEffect(() => {
    const setInitialPickup = async (current: LatLng) => {
      setUserLocation(current);
      if (!pickup) {
        setPickup(current);
        const name = await reverseGeocode(current.lat, current.lng);
        setPickupName(name);
      }
    };

    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data?.latitude && data?.longitude) {
          await setInitialPickup({ lat: Number(data.latitude), lng: Number(data.longitude) });
          toast({ title: "Approximate location used", description: "Enable precise location permission for better accuracy." });
        }
      } catch {
        // ignore fallback errors
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await setInitialPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        async () => { await fallbackToIpLocation(); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      fallbackToIpLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPkg = PACKAGE_TYPES.find(p => p.value === packageType)!;
  const distanceKm = pickup && dropoff ? haversineDistance(pickup, dropoff) : 0;
  const fare = pickup && dropoff ? Math.round(selectedPkg.base + selectedPkg.perKm * distanceKm) : 0;

  const handleMapClick = async (latlng: LatLng) => {
    if (selectingFor === "pickup") {
      setPickup(latlng);
      setPickupName(await reverseGeocode(latlng.lat, latlng.lng));
      setSelectingFor(null);
    } else if (selectingFor === "dropoff") {
      setDropoff(latlng);
      setDropoffName(await reverseGeocode(latlng.lat, latlng.lng));
      setSelectingFor(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pickup || !dropoff) return;
    setLoading(true);

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const { data, error } = await supabase.from("parcels").insert({
      sender_id: user.id,
      pickup_location: pickupName,
      dropoff_location: dropoffName,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      package_description: notes || null,
      package_type: packageType,
      weight_kg: packageType === "document" ? 0.5 : packageType === "small_parcel" ? 3 : 15,
      fare,
      delivery_otp: otp,
    } as any).select().single();

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Parcel booked!", description: `Your delivery OTP is ${otp}. Share it at delivery.` });
      navigate(`/rider/parcels/${data.id}`);
    }
    setLoading(false);
  };

  const canSubmit = pickup && dropoff && recipientName && recipientPhone;

  return (
    <SubscriptionGate fallbackMessage="Subscribe to send parcels on OurYatra.">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Send a Parcel</h2>

      {/* Map */}
      <div className="h-[300px] rounded-xl overflow-hidden border border-border">
        <RideMap
          pickup={pickup}
          dropoff={dropoff}
          driverLocation={null}
          onMapClick={handleMapClick}
          selectingFor={selectingFor}
          userLocation={userLocation}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Locations */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Pickup & Delivery</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <LocationSearch
              label="Pickup Location"
              placeholder="Where to pick up the parcel"
              value={pickupName}
              onSelect={(name, latlng) => { setPickupName(name); setPickup(latlng); }}
              onClear={() => { setPickupName(""); setPickup(null); }}
              onFocusSelect={() => setSelectingFor("pickup")}
              iconColor="text-green-600"
              proximity={userLocation}
            />
            <LocationSearch
              label="Drop-off Location"
              placeholder="Where to deliver"
              value={dropoffName}
              onSelect={(name, latlng) => { setDropoffName(name); setDropoff(latlng); }}
              onClear={() => { setDropoffName(""); setDropoff(null); }}
              onFocusSelect={() => setSelectingFor("dropoff")}
              iconColor="text-destructive"
              proximity={userLocation}
            />
          </CardContent>
        </Card>

        {/* Package Type */}
        <Card>
          <CardHeader><CardTitle className="text-base">Package Type</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {PACKAGE_TYPES.map(pkg => {
                const Icon = pkg.icon;
                const selected = packageType === pkg.value;
                return (
                  <button
                    key={pkg.value}
                    type="button"
                    onClick={() => setPackageType(pkg.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                      selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", selected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>{pkg.label}</span>
                    <span className="text-xs text-muted-foreground">{pkg.desc}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recipient Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Recipient Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input placeholder="Full name" value={recipientName} onChange={e => setRecipientName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Recipient Phone</Label>
              <Input placeholder="+977 98XXXXXXXX" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any instructions for the driver..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Fare Estimate */}
        {pickup && dropoff && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Estimate</p>
                  <p className="text-2xl font-bold text-primary">Rs {fare}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{selectedPkg.label}</p>
                  <p className="text-sm text-foreground">{distanceKm.toFixed(1)} km</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
          {loading ? "Booking..." : `Send Parcel${fare ? ` — Rs ${fare}` : ""}`}
        </Button>
      </form>
    </div>
    </SubscriptionGate>
  );
};

export default SendParcel;
