import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatPanel from "@/components/ChatPanel";
import CallButton from "@/components/CallButton";
import RatingDialog from "@/components/RatingDialog";

const STATUSES = ["pending", "confirmed", "preparing", "ready", "picked_up", "on_the_way", "delivered"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-purple-100 text-purple-800",
  on_the_way: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
};

const FoodOrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const fetchOrder = async () => {
    if (!id) return;
    const { data } = await supabase.from("food_orders").select("*").eq("id", id).single();
    if (data) {
      setOrder(data);
      const { data: r } = await supabase.from("restaurants").select("*").eq("id", data.restaurant_id).single();
      setRestaurant(r);
      if (data.driver_id) {
        const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", data.driver_id).single();
        setDriverProfile(p);
      }
      if (user) {
        const { data: rating } = await supabase.from("ratings").select("id").eq("order_id", id).eq("from_user_id", user.id).limit(1);
        setHasRated((rating?.length || 0) > 0);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); }, [id, user]);

  // Refetch driver profile when driver is assigned via realtime
  useEffect(() => {
    if (!order?.driver_id) return;
    const fetchDriver = async () => {
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", order.driver_id).single();
      setDriverProfile(p);
    };
    fetchDriver();
  }, [order?.driver_id]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`food-order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "food_orders", filter: `id=eq.${id}` }, (payload) => {
        setOrder(payload.new);
        const s = (payload.new as any).status;
        if (s === "confirmed") toast({ title: "Order confirmed by restaurant!" });
        if (s === "ready") toast({ title: "Your order is ready for pickup!" });
        if (s === "picked_up") toast({ title: "Driver picked up your order!" });
        if (s === "on_the_way") toast({ title: "Your order is on the way!" });
        if (s === "delivered") toast({ title: "Order delivered! Enjoy your meal!" });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const cancelOrder = async () => {
    if (!id) return;
    const { error } = await supabase.from("food_orders").update({ status: "cancelled" as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Order cancelled" }); fetchOrder(); }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!order) return <p className="text-destructive">Order not found</p>;

  const statusIdx = STATUSES.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isActive = !isCancelled && order.status !== "delivered";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/rider/food/history")} className="gap-1"><ArrowLeft className="h-4 w-4" /> Order History</Button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Order #{order.id.slice(0, 8)}</h2>
        <Badge className={statusColors[order.status]}>{order.status}</Badge>
      </div>

      {/* Status Progress */}
      {!isCancelled && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between">
              {STATUSES.map((s, i) => (
                <div key={s} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${i <= statusIdx ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center capitalize">{s.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Info */}
      {restaurant && (
        <Card>
          <CardHeader><CardTitle className="text-base">Restaurant Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{restaurant.name}</p>
            <p className="text-sm text-muted-foreground">Pickup address: {restaurant.address}</p>
            <p className="text-sm text-muted-foreground">Contact: {restaurant.phone || "N/A"}</p>
            {restaurant.phone && <CallButton phone={restaurant.phone} />}
          </CardContent>
        </Card>
      )}

      {/* Driver Info */}
      {driverProfile && (
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery Partner</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium">{driverProfile.full_name}</p>
            </div>
            <div className="flex gap-2">
              <CallButton phone={driverProfile.phone} />
              {isActive && <ChatPanel orderId={order.id} orderType="food_order" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(Array.isArray(order.items) ? order.items : []).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span className="text-muted-foreground">Rs {item.price * item.quantity}</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>Rs {order.total_amount}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span>Rs {order.delivery_fee || 50}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>Rs {Number(order.total_amount) + Number(order.delivery_fee || 50)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === "pending" && <Button variant="destructive" onClick={cancelOrder}>Cancel Order</Button>}
        {order.status === "delivered" && !hasRated && (
          <Button variant="outline" onClick={() => setShowRating(true)}>Rate Restaurant</Button>
        )}
      </div>

      {showRating && (
        <RatingDialog
          open={showRating}
          onOpenChange={(o) => { if (!o) { setShowRating(false); fetchOrder(); } }}
          orderId={order.id}
          orderType="food_order"
          restaurantId={order.restaurant_id}
          title="Rate the restaurant"
        />
      )}
    </div>
  );
};

export default FoodOrderTracking;
