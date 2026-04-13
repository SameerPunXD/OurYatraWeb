import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";
import RatingDialog from "@/components/RatingDialog";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryDetailDialog from "@/components/history/HistoryDetailDialog";

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
};

const statusOptions = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const DriverRideHistory = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingRide, setRatingRide] = useState<any>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [ratingsMap, setRatingsMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selected, setSelected] = useState<any>(null);

  const fetchRides = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("rides").select("*").eq("driver_id", user.id).in("status", ["completed", "cancelled"]);
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
    if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); query = query.lte("created_at", e.toISOString()); }
    query = query.order("created_at", { ascending: false }).limit(50);

    const [ridesRes, ratingsRes] = await Promise.all([
      query,
      supabase.from("ratings").select("order_id, rating").eq("from_user_id", user.id).eq("order_type", "ride"),
    ]);
    setRides(ridesRes.data || []);
    const rm = new Map<string, number>();
    const ri = new Set<string>();
    (ratingsRes.data || []).forEach((r: any) => { rm.set(r.order_id, r.rating); ri.add(r.order_id); });
    setRatingsMap(rm);
    setRatedIds(ri);
    setLoading(false);
  };

  useEffect(() => { fetchRides(); }, [user, statusFilter, dateFrom, dateTo]);

  const filtered = rides.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.pickup_location?.toLowerCase().includes(s) || r.dropoff_location?.toLowerCase().includes(s);
  });

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Ride History</h2>

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
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No rides found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(r)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{r.pickup_location} → {r.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">
                    Rs {r.fare} • {format(new Date(r.created_at), "MMM d, yyyy")} • {r.vehicle_type}
                  </p>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Badge className={statusColors[r.status] || ""}>{r.status}</Badge>
                  {r.status === "completed" && !ratedIds.has(r.id) && (
                    <Button size="sm" variant="outline" onClick={() => setRatingRide(r)}>Rate</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ratingRide && (
        <RatingDialog
          open={!!ratingRide}
          onOpenChange={(o) => { if (!o) { setRatingRide(null); fetchRides(); } }}
          orderId={ratingRide.id} orderType="ride" toUserId={ratingRide.rider_id} title="Rate the user"
        />
      )}

      {selected && (
        <HistoryDetailDialog
          open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}
          title="Ride Details" type="ride" status={selected.status}
          rows={[
            { label: "Pickup", value: selected.pickup_location },
            { label: "Dropoff", value: selected.dropoff_location },
            { label: "Vehicle", value: selected.vehicle_type },
            { label: "Fare", value: selected.fare ? `Rs ${selected.fare}` : null },
            { label: "Distance", value: selected.distance_km ? `${selected.distance_km} km` : null },
            { label: "Date", value: format(new Date(selected.created_at), "MMM d, yyyy h:mm a") },
            { label: "Completed", value: selected.completed_at ? format(new Date(selected.completed_at), "MMM d, yyyy h:mm a") : null },
          ]}
          rating={ratingsMap.get(selected.id)}
        />
      )}
    </div>
  );
};

export default DriverRideHistory;
