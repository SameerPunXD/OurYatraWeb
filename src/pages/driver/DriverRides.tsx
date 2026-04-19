import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DeliveryVerificationDialog from "@/components/delivery/DeliveryVerificationDialog";
import type { Database } from "@/integrations/supabase/types";
import RatingDialog from "@/components/RatingDialog";
import ChatPanel from "@/components/ChatPanel";
import CallButton from "@/components/CallButton";
import RideMap from "@/components/ride/RideMap";
import { useDriverLiveLocation } from "@/hooks/useDriverLiveLocation";

type RideStatus = Database["public"]["Enums"]["ride_status"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const DriverRides = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingRides, setPendingRides] = useState<any[]>([]);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingRide, setRatingRide] = useState<any>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [riderPhones, setRiderPhones] = useState<Record<string, string>>({});
  const [riderNames, setRiderNames] = useState<Record<string, string>>({});
  const [verificationRide, setVerificationRide] = useState<any>(null);
  const myDriverLocation = useDriverLiveLocation(user?.id ?? null);

  const fetchRides = async () => {
    if (!user) return;
    const [pending, mine] = await Promise.all([
      supabase.from("rides").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("rides").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setPendingRides(pending.data || []);
    setMyRides(mine.data || []);
    setLoading(false);

    // Fetch rider names/phones for active + pending rides
    const allRideRows = [...(pending.data || []), ...(mine.data || [])];
    const riderIds = [...new Set(allRideRows.filter(r => r.rider_id).map(r => r.rider_id))];
    if (riderIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", riderIds);
      if (profiles) {
        const phones: Record<string, string> = {};
        const names: Record<string, string> = {};
        profiles.forEach(p => {
          if (p.phone) phones[p.id] = p.phone;
          if (p.full_name) names[p.id] = p.full_name;
        });
        setRiderPhones(phones);
        setRiderNames(names);
      }
    }

    const { data: ratings } = await supabase.from("ratings").select("order_id").eq("from_user_id", user.id).eq("order_type", "ride");
    if (ratings) setRatedIds(new Set(ratings.map(r => r.order_id)));
  };

  useEffect(() => { fetchRides(); }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("driver-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => fetchRides())
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_driver_candidates", filter: `driver_id=eq.${user.id}` }, () => fetchRides())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acceptRide = async (rideId: string) => {
    if (!user) return;
    const ride = pendingRides.find(r => r.id === rideId);
    const { error } = await (supabase as any).rpc("claim_ride", { p_ride_id: rideId });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Ride accepted!" });
      if (ride?.rider_id) {
        supabase.rpc("notify_user", { _user_id: ride.rider_id, _title: "Driver Found!", _message: "A driver has accepted your ride request.", _type: "ride" });
      }
      fetchRides();
    }
  };

  const updateStatus = async (rideId: string, status: RideStatus) => {
    const ride = myRides.find(r => r.id === rideId);

    if (status === "completed" && ride?.ride_type === "parcel") {
      setVerificationRide(ride);
      return;
    }

    const updates: Record<string, any> = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(updates).eq("id", rideId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      if (ride?.rider_id) {
        if (status === "in_progress") supabase.rpc("notify_user", { _user_id: ride.rider_id, _title: "Trip Started", _message: "Your ride has started. Enjoy the trip!", _type: "ride" });
        if (status === "completed") supabase.rpc("notify_user", { _user_id: ride.rider_id, _title: "Trip Completed", _message: `Your ride is complete. Fare: Rs ${ride.fare}`, _type: "ride" });
      }
      fetchRides();
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Active Rides</h2>

      {myRides.filter(r => r.status !== "completed" && r.status !== "cancelled").length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">My Accepted Rides</h3>
          {myRides.filter(r => r.status !== "completed" && r.status !== "cancelled").map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{r.pickup_location} → {r.dropoff_location}</p>
                  <Badge className={statusColors[r.status]}>{r.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">User: {riderNames[r.rider_id] || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">Fare: Rs {r.fare} • {r.vehicle_type}</p>
                <div className="h-64 mt-3 rounded-lg overflow-hidden border border-border">
                  <RideMap
                    pickup={r.pickup_lat ? { lat: r.pickup_lat, lng: r.pickup_lng } : null}
                    dropoff={r.dropoff_lat ? { lat: r.dropoff_lat, lng: r.dropoff_lng } : null}
                    driverLocation={myDriverLocation}
                    onMapClick={() => {}}
                    selectingFor={null}
                    userLocation={null}
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {r.status === "accepted" && <Button size="sm" onClick={() => updateStatus(r.id, "in_progress")}>Start Ride</Button>}
                  {r.status === "in_progress" && <Button size="sm" onClick={() => updateStatus(r.id, "completed")}>Complete</Button>}
                  {(r.status === "accepted" || r.status === "in_progress") && (
                    <>
                      <ChatPanel orderId={r.id} orderType="ride" />
                      <CallButton phone={riderPhones[r.rider_id] || null} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed rides with rating */}
      {myRides.filter(r => r.status === "completed").length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Completed Rides</h3>
          {myRides.filter(r => r.status === "completed").slice(0, 5).map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.pickup_location} → {r.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">Rs {r.fare} • {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors.completed}>completed</Badge>
                  {!ratedIds.has(r.id) && (
                    <Button size="sm" variant="outline" onClick={() => setRatingRide(r)}>Rate User</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Available Rides</h3>
        {pendingRides.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No pending rides</p>
          </CardContent></Card>
        ) : pendingRides.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{r.pickup_location} → {r.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">User: {riderNames[r.rider_id] || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">Rs {r.fare} • {r.vehicle_type}</p>
                </div>
                <Button size="sm" onClick={() => acceptRide(r.id)}>Accept</Button>
              </div>
              <div className="h-56 mt-3 rounded-lg overflow-hidden border border-border">
                <RideMap
                  pickup={r.pickup_lat ? { lat: r.pickup_lat, lng: r.pickup_lng } : null}
                  dropoff={r.dropoff_lat ? { lat: r.dropoff_lat, lng: r.dropoff_lng } : null}
                  driverLocation={myDriverLocation}
                  onMapClick={() => {}}
                  selectingFor={null}
                  userLocation={null}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ratingRide && (
        <RatingDialog
          open={!!ratingRide}
          onOpenChange={(o) => { if (!o) { setRatingRide(null); fetchRides(); } }}
          orderId={ratingRide.id}
          orderType="ride"
          toUserId={ratingRide.rider_id}
          title="Rate the user"
        />
      )}

      <DeliveryVerificationDialog
        description="Enter the 6-digit delivery code provided by the customer to complete this parcel delivery."
        onOpenChange={(open) => { if (!open) setVerificationRide(null); }}
        onVerified={async () => {
          if (verificationRide?.rider_id) {
            await supabase.rpc("notify_user", {
              _user_id: verificationRide.rider_id,
              _title: "Parcel Delivered!",
              _message: "Your parcel delivery has been completed.",
              _type: "parcel",
            });
          }
          setVerificationRide(null);
          await fetchRides();
        }}
        open={!!verificationRide}
        orderId={verificationRide?.id || ""}
        target="parcel_ride"
        title="Parcel Delivery Verification"
      />
    </div>
  );
};

export default DriverRides;
