import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryDetailDialog from "@/components/history/HistoryDetailDialog";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  in_transit: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusOptions = [
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending", label: "Pending" },
  { value: "picked_up", label: "Picked Up" },
  { value: "in_transit", label: "In Transit" },
];

const DriverParcelHistory = () => {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const fetchParcels = async () => {
      setLoading(true);
      let query = supabase.from("parcels").select("*").eq("driver_id", user.id);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any) as any;
      if (packageFilter !== "all") query = (query as any).eq("package_type", packageFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
      if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); query = query.lte("created_at", e.toISOString()); }
      const { data } = await query.order("created_at", { ascending: false }).limit(50);
      setParcels(data || []);
      setLoading(false);
    };
    fetchParcels();
  }, [user, statusFilter, packageFilter, dateFrom, dateTo]);

  const filtered = parcels.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.pickup_location?.toLowerCase().includes(s) || p.dropoff_location?.toLowerCase().includes(s) || p.recipient_name?.toLowerCase().includes(s);
  });

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setPackageFilter("all"); setDateFrom(undefined); setDateTo(undefined); };

  const packageSelect = (
    <Select value={packageFilter} onValueChange={setPackageFilter}>
      <SelectTrigger><SelectValue placeholder="Package Type" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        <SelectItem value="document">Document</SelectItem>
        <SelectItem value="small_parcel">Small Parcel</SelectItem>
        <SelectItem value="large_parcel">Large Parcel</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Parcel History</h2>

      <HistoryFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter} statusOptions={statusOptions}
        dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onClear={clearFilters} extraFilters={packageSelect}
      />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No parcels found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(p)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{p.pickup_location} → {p.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">
                    To: {p.recipient_name} • Rs {p.fare} • {format(new Date(p.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge className={statusColors[p.status] || ""}>{p.status?.replace(/_/g, " ")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <HistoryDetailDialog
          open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}
          title="Parcel Details" type="parcel" status={selected.status}
          rows={[
            { label: "Pickup", value: selected.pickup_location },
            { label: "Dropoff", value: selected.dropoff_location },
            { label: "Recipient", value: `${selected.recipient_name} (${selected.recipient_phone})` },
            { label: "Package Type", value: (selected.package_type || "parcel").replace(/_/g, " ") },
            { label: "Weight", value: selected.weight_kg ? `${selected.weight_kg} kg` : null },
            { label: "Delivery Charge", value: selected.fare ? `Rs ${selected.fare}` : null },
            { label: "Delivery Code Verified", value: ["delivered", "otp_verified"].includes(selected.status) ? "Yes" : "No" },
            { label: "Description", value: selected.package_description },
            { label: "Notes", value: selected.notes },
            { label: "Date", value: format(new Date(selected.created_at), "MMM d, yyyy h:mm a") },
            { label: "Delivered", value: selected.delivered_at ? format(new Date(selected.delivered_at), "MMM d, yyyy h:mm a") : null },
          ]}
        />
      )}
    </div>
  );
};

export default DriverParcelHistory;
