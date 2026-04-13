import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ArrowLeft, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SubscriptionGate from "@/components/SubscriptionGate";
import RideMap from "@/components/ride/RideMap";
import LocationSearch from "@/components/ride/LocationSearch";

const DELIVERY_FEE = 50;

interface LatLng {
  lat: number;
  lng: number;
}

const FoodCheckout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, updateQuantity, removeItem, clearCart, totalAmount, totalItems } = useFoodCart();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [ordering, setOrdering] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [deliveryLatLng, setDeliveryLatLng] = useState<LatLng | null>(null);
  const [selectingFor, setSelectingFor] = useState<"pickup" | "dropoff" | null>(null);

  const reverseGeocode = async (lat: number, lng: number) => {
    const locationIqKey = import.meta.env.VITE_LOCATIONIQ_API_KEY;
    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    const pinnedFallback = `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

    try {
      if (locationIqKey) {
        const liqRes = await fetch(`https://us1.locationiq.com/v1/reverse?key=${locationIqKey}&lat=${lat}&lon=${lng}&format=json`);
        if (liqRes.ok) {
          const liq = await liqRes.json();
          if (liq?.display_name) return liq.display_name;
        }
      }
      if (mapboxToken) {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=en&types=address,poi,place,locality,neighborhood`);
        if (res.ok) {
          const data = await res.json();
          return data?.features?.[0]?.place_name || pinnedFallback;
        }
      }
      return pinnedFallback;
    } catch {
      return pinnedFallback;
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("saved_addresses").select("*").eq("user_id", user.id).then(({ data }) => setSavedAddresses(data || []));
  }, [user]);

  useEffect(() => {
    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data?.latitude && data?.longitude) {
          const loc = { lat: Number(data.latitude), lng: Number(data.longitude) };
          setUserLocation(loc);
          if (!deliveryLatLng && !address.trim()) {
            setDeliveryLatLng(loc);
            setAddress(await reverseGeocode(loc.lat, loc.lng));
          }
        }
      } catch {}
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (!deliveryLatLng && !address.trim()) {
            setDeliveryLatLng(loc);
            setAddress(await reverseGeocode(loc.lat, loc.lng));
          }
        },
        async () => { await fallbackToIpLocation(); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      fallbackToIpLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapClick = async (latlng: LatLng) => {
    if (selectingFor === "pickup") {
      setDeliveryLatLng(latlng);
      setAddress(await reverseGeocode(latlng.lat, latlng.lng));
      setSelectingFor(null);
    }
  };

  const handleOrder = async () => {
    if (!user || !cart.restaurantId || !address.trim()) return;
    setOrdering(true);
    const items = cart.items.map((i) => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: i.quantity }));
    const { data, error } = await supabase.from("food_orders").insert({
      customer_id: user.id,
      restaurant_id: cart.restaurantId,
      items,
      total_amount: totalAmount,
      delivery_fee: DELIVERY_FEE,
      delivery_address: address,
      delivery_lat: deliveryLatLng?.lat ?? null,
      delivery_lng: deliveryLatLng?.lng ?? null,
      payment_method: paymentMethod,
    }).select("id").single();
    if (error) {
      toast({ title: "Order failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Order placed!" });
      clearCart();
      navigate(`/rider/food/order/${data.id}`);
    }
    setOrdering(false);
  };

  if (totalItems === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rider/food")} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Card><CardContent className="p-12 text-center text-muted-foreground">Your cart is empty</CardContent></Card>
      </div>
    );
  }

  return (
    <SubscriptionGate fallbackMessage="Subscribe to place food orders on OurYatra.">
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
      <h2 className="text-2xl font-bold text-foreground">Checkout</h2>

      {/* Cart Items */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Your Order — {cart.restaurantName}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">Rs {item.price} × {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delivery Address */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Delivery Address</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {savedAddresses.length > 0 && (
            <Select onValueChange={(v) => {
              setAddress(v);
              const selected = savedAddresses.find((a) => a.address === v);
              if (selected?.lat && selected?.lng) setDeliveryLatLng({ lat: selected.lat, lng: selected.lng });
            }}>
              <SelectTrigger><SelectValue placeholder="Select saved address" /></SelectTrigger>
              <SelectContent>
                {savedAddresses.map((a) => (
                  <SelectItem key={a.id} value={a.address}>{a.label} — {a.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <LocationSearch
            label="Delivery Location"
            placeholder="Type your delivery location"
            value={address}
            onSelect={(name, latlng) => { setAddress(name); setDeliveryLatLng(latlng); }}
            onClear={() => { setAddress(""); setDeliveryLatLng(null); }}
            onFocusSelect={() => setSelectingFor("pickup")}
            iconColor="text-primary"
            proximity={userLocation}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectingFor("pickup")} className="gap-1.5">
              <MapPin className="h-4 w-4" /> Set delivery on map
            </Button>
            <Input placeholder="Apartment / landmark / notes" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="h-56 rounded-xl overflow-hidden border border-border">
            <RideMap
              pickup={deliveryLatLng}
              dropoff={null}
              driverLocation={null}
              onMapClick={handleMapClick}
              selectingFor={selectingFor}
              userLocation={userLocation}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Payment Method</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash">Cash on Delivery</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="online" id="online" />
              <Label htmlFor="online">Online Payment</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-primary">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>Rs {totalAmount}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery Fee</span><span>Rs {DELIVERY_FEE}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>Rs {totalAmount + DELIVERY_FEE}</span></div>
          <Button className="w-full mt-3" size="lg" onClick={handleOrder} disabled={ordering || !address.trim()}>
            {ordering ? "Placing order..." : `Place Order — Rs ${totalAmount + DELIVERY_FEE}`}
          </Button>
        </CardContent>
      </Card>
    </div>
    </SubscriptionGate>
  );
};

export default FoodCheckout;
