import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-blue-100 text-blue-800",
  in_transit: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminParcels = () => {
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("parcels").select("*").order("created_at", { ascending: false }).limit(500);
      if (!data) { setLoading(false); return; }
      const userIds = [...new Set([...data.map(p => p.sender_id), ...data.filter(p => p.driver_id).map(p => p.driver_id!)])];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || "Unknown"]));
      setParcels(data.map(p => ({ ...p, senderName: nameMap[p.sender_id] || "Unknown", driverName: p.driver_id ? nameMap[p.driver_id] || "Unknown" : "Unassigned" })));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = parcels.filter(p => {
    if (tab === "pending") return p.status === "pending";
    if (tab === "active") return p.status === "picked_up" || p.status === "in_transit";
    if (tab === "delivered") return p.status === "delivered";
    if (tab === "cancelled") return p.status === "cancelled";
    return true;
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Parcels ({parcels.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No parcels found</CardContent></Card>
          ) : filtered.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{p.pickup_location} → {p.dropoff_location}</p>
                  <p className="text-sm text-muted-foreground">Sender: {p.senderName} • Driver: {p.driverName} • To: {p.recipient_name}</p>
                  <p className="text-xs text-muted-foreground">Rs {p.fare || 0} • {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className={statusColors[p.status]}>{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminParcels;
