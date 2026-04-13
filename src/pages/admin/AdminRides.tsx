import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(500);
      if (!data) { setLoading(false); return; }
      const userIds = [...new Set([...data.map(r => r.rider_id), ...data.filter(r => r.driver_id).map(r => r.driver_id!)])];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || "Unknown"]));
      setRides(data.map(r => ({ ...r, riderName: nameMap[r.rider_id] || "Unknown", driverName: r.driver_id ? nameMap[r.driver_id] || "Unknown" : "Unassigned" })));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = rides.filter(r => {
    if (tab === "pending") return r.status === "pending";
    if (tab === "active") return r.status === "accepted" || r.status === "in_progress";
    if (tab === "completed") return r.status === "completed";
    if (tab === "cancelled") return r.status === "cancelled";
    return true;
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Rides ({rides.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No rides found</CardContent></Card>
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{r.pickup_location} → {r.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">User: {r.riderName} • Driver: {r.driverName}</p>
                  <p className="text-xs text-muted-foreground">{r.vehicle_type} • Rs {r.fare || 0} • {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className={statusColors[r.status]}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRides;
