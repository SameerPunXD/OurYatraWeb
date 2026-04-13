import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, X, Package, ShieldCheck, Copy } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CallButton from "@/components/CallButton";
import RideMap from "@/components/ride/RideMap";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const statusSteps = [
  { key: "pending", label: "Waiting for Driver", emoji: "🔍" },
  { key: "driver_assigned", label: "Driver Assigned", emoji: "✅" },
  { key: "driver_arriving", label: "Driver Arriving", emoji: "🚗" },
  { key: "picked_up", label: "Picked Up", emoji: "📦" },
  { key: "in_transit", label: "In Transit", emoji: "🚚" },
  { key: "arrived_destination", label: "Arrived", emoji: "📍" },
  { key: "otp_verified", label: "OTP Verified", emoji: "🔐" },
  { key: "delivered", label: "Delivered", emoji: "✅" },
];

const ParcelTracking = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parcel, setParcel] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchParcel = async () => {
    if (!id) return;
    const { data } = await supabase.from("parcels").select("*").eq("id", id).single();
    setParcel(data);
    setLoading(false);
    if (data?.driver_id) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.driver_id).single();
      const { data: details } = await supabase.from("driver_profiles").select("*").eq("id", data.driver_id).single();
      setDriver(profile);
      setDriverDetails(details);
    }
  };

  useEffect(() => { fetchParcel(); }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`parcel-track-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "parcels", filter: `id=eq.${id}` }, (payload) => {
        setParcel(payload.new);
        if ((payload.new as any).driver_id && !(payload.old as any).driver_id) {
          supabase.from("profiles").select("*").eq("id", (payload.new as any).driver_id).single().then(({ data }) => setDriver(data));
          supabase.from("driver_profiles").select("*").eq("id", (payload.new as any).driver_id).single().then(({ data }) => setDriverDetails(data));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const cancelParcel = async () => {
    if (!id) return;
    const { error } = await supabase.from("parcels").update({ status: "cancelled" as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Parcel cancelled" }); navigate("/rider/parcels"); }
  };

  const copyOTP = () => {
    if (parcel?.delivery_otp) {
      navigator.clipboard.writeText(parcel.delivery_otp);
      toast({ title: "OTP Copied!", description: `OTP: ${parcel.delivery_otp}` });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!parcel) return <p className="text-destructive">Parcel not found</p>;

  const currentStep = statusSteps.findIndex(s => s.key === parcel.status);
  const isCancelled = parcel.status === "cancelled";
  const isCompleted = parcel.status === "delivered";
  const showOTP = ["arrived_destination", "otp_verified", "delivered"].includes(parcel.status);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Parcel Tracking</h2>
        <Badge variant={isCancelled ? "destructive" : isCompleted ? "default" : "secondary"}>
          {parcel.status?.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Map */}
      <div className="h-[250px] rounded-xl overflow-hidden border border-border">
        <RideMap
          pickup={parcel.pickup_lat ? { lat: parcel.pickup_lat, lng: parcel.pickup_lng } : null}
          dropoff={parcel.dropoff_lat ? { lat: parcel.dropoff_lat, lng: parcel.dropoff_lng } : null}
          driverLocation={null}
          onMapClick={() => {}}
          selectingFor={null}
          userLocation={null}
        />
      </div>

      {/* Status Progress */}
      {!isCancelled && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-3">
              {statusSteps.map((step, i) => (
                <div key={step.key} className="flex-1">
                  <div className={cn(
                    "h-2 rounded-full transition-colors",
                    i <= currentStep ? "bg-primary" : "bg-muted"
                  )} />
                </div>
              ))}
            </div>
            <p className="font-semibold text-foreground text-center">
              {statusSteps[currentStep]?.emoji} {statusSteps[currentStep]?.label}
            </p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              {parcel.pickup_location} → {parcel.dropoff_location}
            </p>
          </CardContent>
        </Card>
      )}

      {/* OTP Card */}
      {showOTP && parcel.delivery_otp && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Delivery OTP — Share with driver at delivery</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-3xl font-bold tracking-[0.5em] text-primary">{parcel.delivery_otp}</p>
              <Button variant="ghost" size="icon" onClick={copyOTP}><Copy className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver Details */}
      {driver && !isCancelled && !isCompleted && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {driverDetails?.profile_photo_url || driver?.avatar_url ? (
                  <img
                    src={driverDetails?.profile_photo_url || driver?.avatar_url}
                    alt={driver?.full_name || "Driver"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{driver.full_name || "Driver"}</p>
                <p className="text-sm text-muted-foreground">{driver.phone || "Phone unavailable"}</p>
                {driverDetails?.vehicle_type && (
                  <p className="text-xs text-muted-foreground">Vehicle: {driverDetails.vehicle_type}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <ChatPanel orderId={parcel.id} orderType="parcel" />
              <CallButton phone={driver.phone} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parcel Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Package</p>
              <p className="font-medium text-foreground capitalize">{parcel.package_type?.replace(/_/g, " ") || "Parcel"}</p>
              <p className="text-sm text-muted-foreground mt-1">To: {parcel.recipient_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Fare</p>
              <p className="text-xl font-bold text-foreground">Rs {parcel.fare}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel */}
      {parcel.status === "pending" && (
        <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" onClick={cancelParcel}>
          <X className="h-4 w-4 mr-1" /> Cancel Parcel
        </Button>
      )}

      <Button variant="outline" className="w-full" onClick={() => navigate("/rider/parcels")}>
        ← Back to My Parcels
      </Button>
    </div>
  );
};

export default ParcelTracking;
