import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Phone, MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CallButton from "@/components/CallButton";
import CancelRideDialog from "./CancelRideDialog";
import { cn } from "@/lib/utils";

interface ActiveRideTrackerProps {
  ride: any;
  onCancelled: () => void;
  onCompleted: () => void;
}

const statusSteps = [
  { key: "pending", label: "Searching" },
  { key: "accepted", label: "Driver Assigned" },
  { key: "in_progress", label: "Trip Started" },
  { key: "completed", label: "Completed" },
];

const ActiveRideTracker = ({ ride, onCancelled, onCompleted }: ActiveRideTrackerProps) => {
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (ride.driver_id) {
      supabase.from("profiles").select("*").eq("id", ride.driver_id).single().then(({ data }) => setDriverProfile(data));
      supabase.from("driver_profiles").select("*").eq("id", ride.driver_id).single().then(({ data }) => setDriverDetails(data));
    }
  }, [ride.driver_id]);

  useEffect(() => {
    if (ride.status === "completed") onCompleted();
    if (ride.status === "cancelled") onCancelled();
  }, [ride.status]);

  const currentStep = statusSteps.findIndex(s => s.key === ride.status);

  return (
    <div className="space-y-4">
      {/* Status progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-1 mb-3">
            {statusSteps.map((step, i) => (
              <div key={step.key} className="flex-1 flex items-center gap-1">
                <div className={cn(
                  "h-2 rounded-full flex-1 transition-colors",
                  i <= currentStep ? "bg-primary" : "bg-muted"
                )} />
              </div>
            ))}
          </div>
          <p className="font-semibold text-foreground text-center">
            {ride.status === "pending" && "🔍 Looking for a driver..."}
            {ride.status === "accepted" && "🚗 Driver is on the way!"}
            {ride.status === "in_progress" && "🏎️ Trip in progress"}
            {ride.status === "completed" && "✅ Trip completed!"}
          </p>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {ride.pickup_location} → {ride.dropoff_location}
          </p>
        </CardContent>
      </Card>

      {/* Driver details */}
      {driverProfile && (ride.status === "accepted" || ride.status === "in_progress") && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {driverDetails?.profile_photo_url || driverProfile?.avatar_url ? (
                  <img
                    src={driverDetails?.profile_photo_url || driverProfile?.avatar_url}
                    alt={driverProfile?.full_name || "Driver"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{driverProfile.full_name || "Driver"}</p>
                <p className="text-sm text-muted-foreground">{ride.vehicle_type} • Rs {ride.fare}</p>
                <p className="text-xs text-muted-foreground">📞 {driverProfile.phone || "Phone unavailable"}</p>
                {driverDetails?.vehicle_type && (
                  <p className="text-xs text-muted-foreground">Vehicle: {driverDetails.vehicle_type}</p>
                )}
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {ride.status === "accepted" ? "Arriving" : "In Trip"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <ChatPanel orderId={ride.id} orderType="ride" />
              <CallButton phone={driverProfile.phone} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fare card */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Estimated fare</p>
            <p className="text-xl font-bold text-foreground">Rs {ride.fare}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{ride.vehicle_type}</p>
            {ride.distance_km && <p className="text-sm text-foreground">{ride.distance_km} km</p>}
          </div>
        </CardContent>
      </Card>

      {/* Cancel button */}
      {(ride.status === "pending" || ride.status === "accepted") && (
        <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setShowCancel(true)}>
          <X className="h-4 w-4 mr-1" /> Cancel Ride
        </Button>
      )}

      <CancelRideDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        rideId={ride.id}
        onCancelled={onCancelled}
      />
    </div>
  );
};

export default ActiveRideTracker;
