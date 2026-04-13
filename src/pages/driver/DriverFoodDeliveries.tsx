import { useEffect, useState, useCallback } from "react";
import { UtensilsCrossed, MapPin, Package, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import CallButton from "@/components/CallButton";
import RatingDialog from "@/components/RatingDialog";
import type { Database } from "@/integrations/supabase/types";

type FoodOrderStatus = Database["public"]["Enums"]["food_order_status"];

interface FoodOrderWithRestaurant {
  id: string;
  status: FoodOrderStatus;
  delivery_address: string;
  delivery_fee: number | null;
  total_amount: number;
  items: any;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  customer_id: string;
  restaurants: { name: string; address: string; phone: string | null } | null;
}

const statusColors: Record<string, string> = {
  ready: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-blue-100 text-blue-800",
  on_the_way: "bg-primary/10 text-primary",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-destructive/10 text-destructive",
};

const DriverFoodDeliveries = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incoming, setIncoming] = useState<FoodOrderWithRestaurant[]>([]);
  const [active, setActive] = useState<FoodOrderWithRestaurant | null>(null);
  const [history, setHistory] = useState<FoodOrderWithRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingOrder, setRatingOrder] = useState<FoodOrderWithRestaurant | null>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [customerProfiles, setCustomerProfiles] = useState<Record<string, { full_name?: string; phone?: string }>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [readyRes, activeRes, historyRes] = await Promise.all([
      supabase
        .from("food_orders")
        .select("*, restaurants(name, address, phone)")
        .eq("status", "ready")
        .is("driver_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("food_orders")
        .select("*, restaurants(name, address, phone)")
        .eq("driver_id", user.id)
        .in("status", ["picked_up", "on_the_way"])
        .maybeSingle(),
      supabase
        .from("food_orders")
        .select("*, restaurants(name, address, phone)")
        .eq("driver_id", user.id)
        .in("status", ["delivered", "cancelled"])
        .order("delivered_at", { ascending: false })
        .limit(20),
    ]);
    const incomingRows = (readyRes.data as any) || [];
    const activeRow = (activeRes.data as any) || null;
    const historyRows = (historyRes.data as any) || [];

    setIncoming(incomingRows);
    setActive(activeRow);
    setHistory(historyRows);

    const customerIds = [...new Set([
      ...incomingRows.map((o: any) => o.customer_id),
      ...(activeRow ? [activeRow.customer_id] : []),
      ...historyRows.map((o: any) => o.customer_id),
    ].filter(Boolean))];

    if (customerIds.length > 0) {
      const { data: cProf } = await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds);
      const map: Record<string, { full_name?: string; phone?: string }> = {};
      (cProf || []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, phone: p.phone }; });
      setCustomerProfiles(map);
    }

    if (user) {
      const { data: ratings } = await supabase.from("ratings").select("order_id").eq("from_user_id", user.id).eq("order_type", "food_order");
      if (ratings) setRatedIds(new Set(ratings.map(r => r.order_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel("driver-food-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "food_orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const acceptOrder = async (id: string) => {
    if (!user) return;
    const order = incoming.find(o => o.id === id);
    const { error } = await supabase
      .from("food_orders")
      .update({ driver_id: user.id, status: "picked_up" as FoodOrderStatus })
      .eq("id", id);
    if (error) toast({ title: "Failed to accept", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Order accepted! Head to restaurant for pickup." });
      if (order?.customer_id) {
        supabase.rpc("notify_user", { _user_id: order.customer_id, _title: "Driver Assigned", _message: "A delivery partner has picked up your order!", _type: "food" });
      }
      fetchData();
    }
  };

  const updateStatus = async (id: string, status: FoodOrderStatus) => {
    const updates: Record<string, any> = { status };
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("food_orders").update(updates).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      if (active?.customer_id) {
        if (status === "on_the_way") supabase.rpc("notify_user", { _user_id: active.customer_id, _title: "On the Way!", _message: "Your food order is on the way.", _type: "food" });
        if (status === "delivered") supabase.rpc("notify_user", { _user_id: active.customer_id, _title: "Order Delivered!", _message: "Your food order has been delivered. Enjoy your meal!", _type: "food" });
      }
      fetchData();
    }
  };

  const itemCount = (items: any) => {
    if (Array.isArray(items)) return items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
    return 0;
  };

  if (loading) return <p className="text-muted-foreground p-4">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Food Deliveries</h2>

      {/* Active Delivery */}
      {active && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" /> Active Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{active.restaurants?.name || "Restaurant"}</p>
                <p className="text-sm text-muted-foreground">Pickup address: {active.restaurants?.address || "N/A"}</p>
                <p className="text-sm text-muted-foreground">Restaurant contact: {active.restaurants?.phone || "N/A"}</p>
              </div>
              <Badge className={statusColors[active.status] || ""}>{active.status.replace("_", " ")}</Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm"><MapPin className="h-3 w-3 inline mr-1" />Deliver to: {active.delivery_address}</p>
              <p className="text-sm"><Package className="h-3 w-3 inline mr-1" />{itemCount(active.items)} item(s) • Rs {active.total_amount}</p>
              <p className="text-sm"><DollarSign className="h-3 w-3 inline mr-1" />Delivery fee: Rs {active.delivery_fee || 0}</p>
              <p className="text-sm text-muted-foreground">Pickup address: {active.restaurants?.address || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Restaurant contact: {active.restaurants?.phone || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Customer: {customerProfiles[active.customer_id]?.full_name || "Customer"}</p>
              <p className="text-sm text-muted-foreground">Customer contact: {customerProfiles[active.customer_id]?.phone || "N/A"}</p>
              {active.notes && <p className="text-sm text-muted-foreground">Note: {active.notes}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {active.status === "picked_up" && (
                <Button size="sm" onClick={() => updateStatus(active.id, "on_the_way" as FoodOrderStatus)}>On the Way</Button>
              )}
              {active.status === ("on_the_way" as FoodOrderStatus) && (
                <Button size="sm" onClick={() => updateStatus(active.id, "delivered")}>Mark Delivered</Button>
              )}
              <CallButton phone={active.restaurants?.phone} />
              <CallButton phone={customerProfiles[active.customer_id]?.phone} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incoming Requests */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Available Pickup Requests</h3>
        {incoming.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UtensilsCrossed className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No food orders ready for pickup right now</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {incoming.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
                      <UtensilsCrossed className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{order.restaurants?.name || "Restaurant"}</p>
                      <p className="text-xs text-muted-foreground">
                        {itemCount(order.items)} items • Rs {order.delivery_fee || 0} fee → {order.delivery_address}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => acceptOrder(order.id)} disabled={!!active}>Accept</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delivery History */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Delivery History</h3>
        {history.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No past food deliveries</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {history.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{order.restaurants?.name || "Restaurant"}</p>
                      <p className="text-xs text-muted-foreground">
                        Rs {order.delivery_fee || 0} • {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
                    {order.status === "delivered" && !ratedIds.has(order.id) && (
                      <Button size="sm" variant="outline" onClick={() => setRatingOrder(order)}>Rate</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {ratingOrder && (
        <RatingDialog
          open={!!ratingOrder}
          onOpenChange={(o) => { if (!o) { setRatingOrder(null); fetchData(); } }}
          orderId={ratingOrder.id}
          orderType="food_order"
          restaurantId={ratingOrder.restaurants ? undefined : undefined}
          toUserId={ratingOrder.customer_id}
          title="Rate the customer"
        />
      )}
    </div>
  );
};

export default DriverFoodDeliveries;
