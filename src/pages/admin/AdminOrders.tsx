import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("food_orders").select("*, restaurants(name)").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Food Orders ({orders.length})</h2>
      <div className="space-y-2">
        {orders.map(o => (
          <Card key={o.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Order #{o.id.slice(0, 8)} — {(o as any).restaurants?.name || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">Rs {o.total_amount} • {new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <Badge className={statusColors[o.status]}>{o.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && <p className="text-muted-foreground">No orders yet</p>}
      </div>
    </div>
  );
};

export default AdminOrders;
