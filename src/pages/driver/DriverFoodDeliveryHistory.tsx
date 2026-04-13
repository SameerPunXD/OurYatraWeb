import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed } from "lucide-react";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryDetailDialog from "@/components/history/HistoryDetailDialog";

const statusColors: Record<string, string> = {
  picked_up: "bg-cyan-100 text-cyan-800",
  on_the_way: "bg-blue-100 text-blue-800",
  delivered: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
};

const statusOptions = [
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "picked_up", label: "Picked Up" },
  { value: "on_the_way", label: "On the Way" },
];

const DriverFoodDeliveryHistory = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      let query = supabase.from("food_orders").select("*, restaurants(name)").eq("driver_id", user.id);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
      if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); query = query.lte("created_at", e.toISOString()); }
      const { data } = await query.order("created_at", { ascending: false }).limit(50);
      setOrders(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, statusFilter, dateFrom, dateTo]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o as any).restaurants?.name?.toLowerCase().includes(s) || o.delivery_address?.toLowerCase().includes(s);
  });

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); };

  const totalEarnings = filtered.filter(o => o.status === "delivered").reduce((s, o) => s + (o.delivery_fee || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Food Delivery History</h2>
        <div className="text-sm text-muted-foreground">
          Total Earnings: <span className="font-semibold text-foreground">Rs {totalEarnings}</span>
        </div>
      </div>

      <HistoryFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter} statusOptions={statusOptions}
        dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onClear={clearFilters}
      />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No food deliveries found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <Card key={o.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(o)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{(o as any).restaurants?.name || "Restaurant"}</p>
                  <p className="text-sm text-muted-foreground">
                    Rs {o.delivery_fee || 0} earned • {format(new Date(o.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge className={statusColors[o.status] || ""}>{o.status?.replace(/_/g, " ")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <HistoryDetailDialog
          open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}
          title="Food Delivery Details" type="food" status={selected.status}
          rows={[
            { label: "Restaurant", value: (selected as any).restaurants?.name },
            { label: "Delivery Address", value: selected.delivery_address },
            { label: "Order Total", value: `Rs ${selected.total_amount}` },
            { label: "Delivery Fee Earned", value: `Rs ${selected.delivery_fee || 0}` },
            { label: "Date", value: format(new Date(selected.created_at), "MMM d, yyyy h:mm a") },
            { label: "Delivered", value: selected.delivered_at ? format(new Date(selected.delivered_at), "MMM d, yyyy h:mm a") : null },
          ]}
          items={(Array.isArray(selected.items) ? selected.items : []).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))}
        />
      )}
    </div>
  );
};

export default DriverFoodDeliveryHistory;
