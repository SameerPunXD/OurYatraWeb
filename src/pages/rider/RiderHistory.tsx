import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Car, Package, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryDetailDialog from "@/components/history/HistoryDetailDialog";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  on_the_way: "bg-blue-100 text-blue-800",
  delivered: "bg-green-200 text-green-900",
  in_transit: "bg-blue-100 text-blue-800",
};

interface HistoryItem {
  id: string;
  type: "ride" | "parcel" | "food";
  title: string;
  subtitle: string;
  status: string;
  amount: number | null;
  date: string;
  raw: any;
  driverName?: string;
  rating?: number | null;
}

const RiderHistory = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoading(true);
      const [rides, parcels, food, ratings] = await Promise.all([
        supabase.from("rides").select("*").eq("rider_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("parcels").select("*").eq("sender_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("food_orders").select("*, restaurants(name)").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("ratings").select("order_id, rating").eq("from_user_id", user.id),
      ]);

      const ratingsMap = new Map<string, number>();
      (ratings.data || []).forEach((r: any) => ratingsMap.set(r.order_id, r.rating));

      const all: HistoryItem[] = [
        ...(rides.data || []).map((r: any) => ({
          id: r.id, type: "ride" as const, title: `${r.pickup_location} → ${r.dropoff_location}`,
          subtitle: `${r.vehicle_type || "car"} ride`, status: r.status, amount: r.fare, date: r.created_at,
          raw: r, rating: ratingsMap.get(r.id),
        })),
        ...(parcels.data || []).map((p: any) => ({
          id: p.id, type: "parcel" as const, title: `${p.pickup_location} → ${p.dropoff_location}`,
          subtitle: `To ${p.recipient_name}`, status: p.status, amount: p.fare, date: p.created_at,
          raw: p, rating: ratingsMap.get(p.id),
        })),
        ...(food.data || []).map((f: any) => ({
          id: f.id, type: "food" as const, title: `${(f as any).restaurants?.name || "Restaurant"}`,
          subtitle: f.delivery_address || "Food delivery", status: f.status, amount: f.total_amount, date: f.created_at,
          raw: f, rating: ratingsMap.get(f.id),
        })),
      ];
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(all);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  const typeIcons = { ride: Car, parcel: Package, food: UtensilsCrossed };

  const filtered = items.filter(i => {
    if (filter !== "all" && i.type !== filter) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!i.title.toLowerCase().includes(s) && !i.subtitle.toLowerCase().includes(s)) return false;
    }
    if (dateFrom && new Date(i.date) < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      if (new Date(i.date) > end) return false;
    }
    return true;
  });

  const allStatuses = [...new Set(items.filter(i => filter === "all" || i.type === filter).map(i => i.status))];

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); };

  const buildDetailRows = (item: HistoryItem) => {
    const r = item.raw;
    if (item.type === "ride") return [
      { label: "Pickup", value: r.pickup_location },
      { label: "Dropoff", value: r.dropoff_location },
      { label: "Vehicle", value: r.vehicle_type },
      { label: "Fare", value: r.fare ? `Rs ${r.fare}` : null },
      { label: "Distance", value: r.distance_km ? `${r.distance_km} km` : null },
      { label: "Status", value: r.status?.replace(/_/g, " ") },
      { label: "Date", value: format(new Date(r.created_at), "MMM d, yyyy h:mm a") },
    ];
    if (item.type === "parcel") return [
      { label: "Pickup", value: r.pickup_location },
      { label: "Dropoff", value: r.dropoff_location },
      { label: "Recipient", value: `${r.recipient_name} (${r.recipient_phone})` },
      { label: "Package Type", value: (r.package_type || "parcel").replace(/_/g, " ") },
      { label: "Weight", value: r.weight_kg ? `${r.weight_kg} kg` : null },
      { label: "Delivery Charge", value: r.fare ? `Rs ${r.fare}` : null },
      { label: "Delivery Code Verified", value: ["delivered", "otp_verified"].includes(r.status) ? "Yes" : "No" },
      { label: "Status", value: r.status?.replace(/_/g, " ") },
      { label: "Date", value: format(new Date(r.created_at), "MMM d, yyyy h:mm a") },
    ];
    // food
    return [
      { label: "Restaurant", value: r.restaurants?.name },
      { label: "Delivery Address", value: r.delivery_address },
      { label: "Subtotal", value: `Rs ${r.total_amount}` },
      { label: "Delivery Fee", value: `Rs ${r.delivery_fee || 0}` },
      { label: "Total", value: `Rs ${Number(r.total_amount) + Number(r.delivery_fee || 0)}` },
      { label: "Status", value: r.status?.replace(/_/g, " ") },
      { label: "Ordered", value: format(new Date(r.created_at), "MMM d, yyyy h:mm a") },
      { label: "Delivered", value: r.delivered_at ? format(new Date(r.delivered_at), "MMM d, yyyy h:mm a") : null },
    ];
  };

  const getFoodItems = (item: HistoryItem) => {
    if (item.type !== "food") return undefined;
    const raw = Array.isArray(item.raw.items) ? item.raw.items : [];
    return raw.map((i: any) => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">History</h2>
        <p className="text-muted-foreground">All your rides, parcels, and food orders</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v); setStatusFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="ride">Rides ({items.filter(i => i.type === "ride").length})</TabsTrigger>
          <TabsTrigger value="parcel">Parcels ({items.filter(i => i.type === "parcel").length})</TabsTrigger>
          <TabsTrigger value="food">Food ({items.filter(i => i.type === "food").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <HistoryFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        statusOptions={allStatuses.map(s => ({ value: s, label: s.replace(/_/g, " ") }))}
        dateFrom={dateFrom} dateTo={dateTo}
        onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onClear={clearFilters}
      />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading history...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No results found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const Icon = typeIcons[item.type];
            return (
              <Card key={item.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(item)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle} • {new Date(item.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.amount != null && <span className="text-sm font-semibold text-foreground">Rs {item.amount}</span>}
                    <Badge className={statusColors[item.status] || "bg-muted text-foreground"}>{item.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <HistoryDetailDialog
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          title={selected.type === "ride" ? "Ride Details" : selected.type === "parcel" ? "Parcel Details" : "Food Order Details"}
          type={selected.type}
          status={selected.status}
          rows={buildDetailRows(selected)}
          items={getFoodItems(selected)}
          rating={selected.rating}
        />
      )}
    </div>
  );
};

export default RiderHistory;
