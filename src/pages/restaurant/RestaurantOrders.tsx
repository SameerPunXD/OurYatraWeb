import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, CheckCircle, XCircle, ChevronDown, ChevronUp, Phone, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type FoodOrderStatus = Database["public"]["Enums"]["food_order_status"];

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

const nextStatus: Partial<Record<FoodOrderStatus, FoodOrderStatus>> = {
  confirmed: "preparing",
  preparing: "ready",
};

const tabs: { value: string; label: string; statuses: FoodOrderStatus[] }[] = [
  { value: "all", label: "All", statuses: [] },
  { value: "new", label: "New", statuses: ["pending"] },
  { value: "preparing", label: "Preparing", statuses: ["confirmed", "preparing"] },
  { value: "ready", label: "Ready", statuses: ["ready"] },
  { value: "out", label: "Out for Delivery", statuses: ["picked_up", "on_the_way"] },
  { value: "delivered", label: "Delivered", statuses: ["delivered"] },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

const RestaurantOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    const { data: restaurant } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
    if (!restaurant) { setLoading(false); return; }
    setRestaurantId(restaurant.id);
    const { data } = await supabase.from("food_orders").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false });
    const orderList = data || [];
    setOrders(orderList);

    // Fetch customer profiles
    const customerIds = [...new Set(orderList.map((o) => o.customer_id))];
    if (customerIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [user]);

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("restaurant-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "food_orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  const updateOrder = async (id: string, status: FoodOrderStatus) => {
    const order = orders.find(o => o.id === id);
    const { error } = await supabase.from("food_orders").update({ status }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Order marked as ${status}` });
      if (order?.customer_id) {
        if (status === "confirmed") supabase.rpc("notify_user", { _user_id: order.customer_id, _title: "Order Confirmed", _message: "Your food order has been confirmed by the restaurant!", _type: "food" });
        if (status === "preparing") supabase.rpc("notify_user", { _user_id: order.customer_id, _title: "Preparing Your Order", _message: "The restaurant is now preparing your food.", _type: "food" });
        if (status === "ready") supabase.rpc("notify_user", { _user_id: order.customer_id, _title: "Order Ready!", _message: "Your order is ready for pickup by the delivery partner.", _type: "food" });
      }
      fetchOrders();
    }
  };

  const getFilteredOrders = (statuses: FoodOrderStatus[]) => {
    if (statuses.length === 0) return orders;
    return orders.filter((o) => statuses.includes(o.status));
  };

  const countForTab = (statuses: FoodOrderStatus[]) => {
    if (statuses.length === 0) return orders.length;
    return orders.filter((o) => statuses.includes(o.status)).length;
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const renderOrder = (o: any) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const next = nextStatus[o.status as FoodOrderStatus];
    const customer = profiles[o.customer_id];
    const isExpanded = expandedId === o.id;

    return (
      <Card key={o.id}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-foreground">Order #{o.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[o.status]}>{o.status}</Badge>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-3 border-t border-border pt-3">
              {/* Customer */}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{customer?.full_name || "Customer"}</span>
                {customer?.phone && (
                  <a href={`tel:${customer.phone}`} className="text-primary hover:underline flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {customer.phone}
                  </a>
                )}
              </div>

              {/* Items */}
              <div className="text-sm space-y-1">
                <p className="font-medium text-foreground">Items:</p>
                {items.map((item: any, i: number) => (
                  <p key={i} className="text-muted-foreground pl-2">{item.quantity}x {item.name} — Rs {item.price * item.quantity}</p>
                ))}
              </div>

              {/* Delivery */}
              <div className="text-sm">
                <p className="text-muted-foreground">📍 {o.delivery_address}</p>
                {o.notes && <p className="text-muted-foreground">📝 {o.notes}</p>}
              </div>

              {/* Driver */}
              {o.driver_id && (
                <div className="text-sm text-muted-foreground">
                  <p>🚗 Driver assigned</p>
                </div>
              )}

              {/* Total + Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="font-semibold text-foreground">Total: Rs {o.total_amount}</p>
                <div className="flex gap-2">
                  {o.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => updateOrder(o.id, "confirmed")}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updateOrder(o.id, "cancelled")}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {next && <Button size="sm" onClick={() => updateOrder(o.id, next)}>Mark as {next}</Button>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Orders</h2>

      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label} ({countForTab(t.statuses)})
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {getFilteredOrders(t.statuses).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No {t.label.toLowerCase()} orders</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {getFilteredOrders(t.statuses).map(renderOrder)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default RestaurantOrders;
