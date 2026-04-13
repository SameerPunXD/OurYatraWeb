import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw } from "lucide-react";
import RatingDialog from "@/components/RatingDialog";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryDetailDialog from "@/components/history/HistoryDetailDialog";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-purple-100 text-purple-800",
  on_the_way: "bg-blue-100 text-blue-800",
  delivered: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
};

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "picked_up", label: "Picked Up" },
  { value: "on_the_way", label: "On the Way" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const FoodOrderHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useFoodCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [ratingsMap, setRatingsMap] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<any>(null);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("food_orders").select("*, restaurants(name)").eq("customer_id", user.id);
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
    if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); query = query.lte("created_at", e.toISOString()); }
    const { data } = await query.order("created_at", { ascending: false }).limit(50);
    setOrders(data || []);

    const { data: ratings } = await supabase.from("ratings").select("order_id, rating").eq("from_user_id", user.id).eq("order_type", "food_order");
    const rm = new Map<string, number>();
    const ri = new Set<string>();
    (ratings || []).forEach((r) => { rm.set(r.order_id, r.rating); ri.add(r.order_id); });
    setRatingsMap(rm);
    setRatedIds(ri);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [user, statusFilter, dateFrom, dateTo]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    const restaurantName = (o as any).restaurants?.name || "";
    const itemNames = (Array.isArray(o.items) ? o.items : []).map((i: any) => i.name).join(" ");
    return restaurantName.toLowerCase().includes(s) || itemNames.toLowerCase().includes(s);
  });

  const handleReorder = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item: any) => {
      addItem({ id: item.menu_item_id, name: item.name, price: item.price }, order.restaurant_id, (order as any).restaurants?.name || "Restaurant");
    });
    navigate("/rider/food/checkout");
  };

  const isActive = (s: string) => ["pending", "confirmed", "preparing", "ready", "picked_up", "on_the_way"].includes(s);
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rider/food")}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="text-2xl font-bold text-foreground">Food Order History</h2>
      </div>

      <HistoryFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter} statusOptions={statusOptions}
        dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onClear={clearFilters}
      />

      {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No orders found</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Card key={o.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(o)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">#{o.id.slice(0, 8)} — {(o as any).restaurants?.name || "Restaurant"}</p>
                    <p className="text-sm text-muted-foreground">Rs {o.total_amount} • {format(new Date(o.created_at), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(Array.isArray(o.items) ? o.items : []).map((i: any) => `${i.name}×${i.quantity}`).join(", ")}
                    </p>
                  </div>
                  <Badge className={statusColors[o.status]}>{o.status.replace("_", " ")}</Badge>
                </div>
                <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  {isActive(o.status) && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/rider/food/order/${o.id}`)}>Track</Button>
                  )}
                  {o.status === "delivered" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleReorder(o)}>
                        <RotateCcw className="h-3 w-3" /> Reorder
                      </Button>
                      {!ratedIds.has(o.id) && (
                        <Button size="sm" variant="outline" onClick={() => setRatingOrder(o)}>Rate</Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ratingOrder && (
        <RatingDialog
          open={!!ratingOrder}
          onOpenChange={(o) => { if (!o) { setRatingOrder(null); fetchOrders(); } }}
          orderId={ratingOrder.id} orderType="food_order" restaurantId={ratingOrder.restaurant_id} title="Rate the restaurant"
        />
      )}

      {selected && (
        <HistoryDetailDialog
          open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}
          title="Food Order Details" type="food" status={selected.status}
          rows={[
            { label: "Restaurant", value: (selected as any).restaurants?.name },
            { label: "Delivery Address", value: selected.delivery_address },
            { label: "Subtotal", value: `Rs ${selected.total_amount}` },
            { label: "Delivery Fee", value: `Rs ${selected.delivery_fee || 0}` },
            { label: "Total", value: `Rs ${Number(selected.total_amount) + Number(selected.delivery_fee || 0)}` },
            { label: "Ordered", value: format(new Date(selected.created_at), "MMM d, yyyy h:mm a") },
            { label: "Delivered", value: selected.delivered_at ? format(new Date(selected.delivered_at), "MMM d, yyyy h:mm a") : null },
          ]}
          items={(Array.isArray(selected.items) ? selected.items : []).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))}
          rating={ratingsMap.get(selected.id)}
        />
      )}
    </div>
  );
};

export default FoodOrderHistory;
