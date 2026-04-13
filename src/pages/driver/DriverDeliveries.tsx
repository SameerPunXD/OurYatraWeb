import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/ChatPanel";
import CallButton from "@/components/CallButton";
import ParcelOTPVerification from "@/components/parcel/ParcelOTPVerification";
import RatingDialog from "@/components/RatingDialog";

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

const DriverDeliveries = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingParcels, setPendingParcels] = useState<any[]>([]);
  const [myParcels, setMyParcels] = useState<any[]>([]);
  const [deliveredParcels, setDeliveredParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpParcelId, setOtpParcelId] = useState<string | null>(null);
  const [ratingParcel, setRatingParcel] = useState<any>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [senderPhones, setSenderPhones] = useState<Record<string, string>>({});

  const fetchParcels = async () => {
    if (!user) return;
    const [pending, mine, delivered] = await Promise.all([
      supabase.from("parcels").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("parcels").select("*").eq("driver_id", user.id).not("status", "in", '("delivered","cancelled","otp_verified")').order("created_at", { ascending: false }),
      supabase.from("parcels").select("*").eq("driver_id", user.id).in("status", ["delivered", "otp_verified"]).order("created_at", { ascending: false }).limit(5),
    ]);
    setPendingParcels(pending.data || []);
    setMyParcels(mine.data || []);
    setDeliveredParcels(delivered.data || []);

    const allParcels = [...(pending.data || []), ...(mine.data || []), ...(delivered.data || [])];
    const senderIds = [...new Set(allParcels.filter(p => p.sender_id).map(p => p.sender_id))];
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", senderIds);
      if (profiles) {
        const names: Record<string, string> = {};
        const phones: Record<string, string> = {};
        profiles.forEach(p => {
          if (p.full_name) names[p.id] = p.full_name;
          if (p.phone) phones[p.id] = p.phone;
        });
        setSenderNames(names);
        setSenderPhones(phones);
      }
    }

    if (user) {
      const { data: ratings } = await supabase.from("ratings").select("order_id").eq("from_user_id", user.id).eq("order_type", "parcel");
      if (ratings) setRatedIds(new Set(ratings.map(r => r.order_id)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchParcels(); }, [user]);

  useEffect(() => {
    const channel = supabase.channel("driver-parcels")
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, () => fetchParcels())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acceptParcel = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("parcels").update({
      driver_id: user.id,
      status: "driver_assigned" as any,
    } as any).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Parcel accepted!" }); fetchParcels(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const parcel = myParcels.find(p => p.id === id);
    const updates: Record<string, any> = { status };
    if (status === "picked_up") updates.picked_up_at = new Date().toISOString();
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("parcels").update(updates as any).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      if (parcel?.sender_id && status === "delivered") {
        supabase.rpc("notify_user", { _user_id: parcel.sender_id, _title: "Parcel Delivered!", _message: `Your parcel to ${parcel.recipient_name} has been delivered.`, _type: "parcel" });
      }
      fetchParcels();
    }
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case "driver_assigned": return { label: "Heading to Pickup", next: "driver_arriving" };
      case "driver_arriving": return { label: "Pick Up Parcel", next: "picked_up" };
      case "picked_up": return { label: "Start Transit", next: "in_transit" };
      case "in_transit": return { label: "Arrived at Destination", next: "arrived_destination" };
      case "arrived_destination": return { label: "Verify OTP & Deliver", next: "otp" };
      default: return null;
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Deliveries</h2>

      {myParcels.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">My Active Deliveries</h3>
          {myParcels.map(p => {
            const action = getNextAction(p.status);
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{p.pickup_location} → {p.dropoff_location}</p>
                    <Badge className={statusColors[p.status]}>{p.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sender: {senderNames[p.sender_id] || "Unknown"} {senderPhones[p.sender_id] ? `• ${senderPhones[p.sender_id]}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To: {p.recipient_name} • Rs {p.fare} • <span className="capitalize">{(p as any).package_type?.replace(/_/g, " ") || "parcel"}</span>
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {action && (
                      action.next === "otp" ? (
                        <Button size="sm" onClick={() => setOtpParcelId(p.id)}>{action.label}</Button>
                      ) : (
                        <Button size="sm" onClick={() => updateStatus(p.id, action.next)}>{action.label}</Button>
                      )
                    )}
                    <ChatPanel orderId={p.id} orderType="parcel" />
                    <CallButton phone={p.recipient_phone} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">Available Parcels</h3>
        {pendingParcels.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No pending deliveries</p>
          </CardContent></Card>
        ) : pendingParcels.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{p.pickup_location} → {p.dropoff_location}</p>
                <p className="text-sm text-muted-foreground">
                  Sender: {senderNames[p.sender_id] || "Unknown"} {senderPhones[p.sender_id] ? `• ${senderPhones[p.sender_id]}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.recipient_name} • Rs {p.fare} • <span className="capitalize">{(p as any).package_type?.replace(/_/g, " ") || "parcel"}</span>
                </p>
              </div>
              <Button size="sm" onClick={() => acceptParcel(p.id)}>Accept</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivered parcels with rating */}
      {deliveredParcels.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Recently Delivered</h3>
          {deliveredParcels.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.pickup_location} → {p.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">Rs {p.fare}</p>
                </div>
                {!ratedIds.has(p.id) && (
                  <Button size="sm" variant="outline" onClick={() => setRatingParcel(p)}>Rate</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {otpParcelId && (
        <ParcelOTPVerification
          parcelId={otpParcelId}
          open={!!otpParcelId}
          onOpenChange={(open) => { if (!open) setOtpParcelId(null); }}
          onVerified={() => { setOtpParcelId(null); fetchParcels(); }}
        />
      )}

      {ratingParcel && (
        <RatingDialog
          open={!!ratingParcel}
          onOpenChange={(o) => { if (!o) { setRatingParcel(null); fetchParcels(); } }}
          orderId={ratingParcel.id}
          orderType="parcel"
          toUserId={ratingParcel.sender_id}
          title="Rate the sender"
        />
      )}
    </div>
  );
};

export default DriverDeliveries;
