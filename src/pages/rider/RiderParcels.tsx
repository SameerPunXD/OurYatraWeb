import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  driver_assigned: "bg-blue-100 text-blue-800",
  driver_arriving: "bg-indigo-100 text-indigo-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  in_transit: "bg-purple-100 text-purple-800",
  arrived_destination: "bg-orange-100 text-orange-800",
  otp_verified: "bg-emerald-100 text-emerald-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const activeStatuses = ["pending", "driver_assigned", "driver_arriving", "picked_up", "in_transit", "arrived_destination", "otp_verified"];

const RiderParcels = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParcels = async () => {
    if (!user) return;
    const { data } = await supabase.from("parcels").select("*").eq("sender_id", user.id).order("created_at", { ascending: false });
    setParcels(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchParcels(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("rider-parcels")
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, (payload) => {
        fetchParcels();
        if (payload.eventType === "UPDATE" && (payload.new as any).sender_id === user?.id) {
          const status = (payload.new as any).status;
          if (status === "driver_assigned") toast({ title: "Driver assigned!", description: "A driver accepted your parcel." });
          if (status === "picked_up") toast({ title: "Parcel picked up!", description: "Your parcel is on its way." });
          if (status === "arrived_destination") toast({ title: "Driver arrived!", description: "Share your 6-digit delivery code to confirm delivery." });
          if (status === "delivered") toast({ title: "Parcel delivered!", description: "Your parcel has been delivered." });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const cancelParcel = async (id: string) => {
    const { error } = await supabase.from("parcels").update({ status: "cancelled" as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Parcel cancelled" }); fetchParcels(); }
  };

  const isActive = (status: string) => activeStatuses.includes(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">My Parcels</h2>
        <Button asChild><Link to="/rider/send-parcel">Send Parcel</Link></Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : parcels.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No parcels yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {parcels.map(p => (
            <Card key={p.id} className={isActive(p.status) ? "border-primary/20" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{p.pickup_location} → {p.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">To: {p.recipient_name} • {p.recipient_phone}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {(p as any).package_type?.replace(/_/g, " ") || "Parcel"} • {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right space-y-1 flex flex-col items-end gap-1">
                  <Badge className={statusColors[p.status] || ""}>{p.status?.replace(/_/g, " ")}</Badge>
                  {p.fare && <p className="text-sm font-semibold">Rs {p.fare}</p>}
                  {isActive(p.status) && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/rider/parcels/${p.id}`}><Eye className="h-3 w-3 mr-1" /> Track</Link>
                    </Button>
                  )}
                  {p.status === "pending" && (
                    <Button size="sm" variant="destructive" onClick={() => cancelParcel(p.id)}>Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiderParcels;
